// app/api/pyth-price-accounts/route.ts

import { NextResponse } from "next/server";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Keypair } from "@solana/web3.js";

// ---- CONFIG ----

// (1) Your Solana RPC endpoint (must be mainnet / whatever your program is on)
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// (2) Pyth feed IDs for the assets in your market.
// You MUST set these correctly for your collateral asset and borrow asset.
const COLLATERAL_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const BORROW_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

// (3) Backend wallet that will pay rent for the temporary Pyth price update accounts.
// This MUST stay server-side. NEVER expose the secret.
// Here I'm reading a secret keypair from an env var as a JSON array of numbers.
// Example env: BACKEND_SECRET_KEY='[12,34,56,...]'
function getBackendWallet() {
  const raw = process.env.NEXT_PRIVATE_KEEPER_KEY;
  if (!raw) {
    throw new Error("Missing BACKEND_SECRET_KEY env var");
  }

  const secretBytes = Uint8Array.from(JSON.parse(raw));
  const kp = Keypair.fromSecretKey(secretBytes);

  // PythSolanaReceiver expects an Anchor-style wallet:
  // { publicKey, signAllTransactions(txs) }
  const wallet = {
    publicKey: kp.publicKey,
    signAllTransactions: async (txs: VersionedTransaction[]) => {
      for (const tx of txs) {
        tx.sign([kp]);
      }
      return txs;
    },
  };

  return wallet;
}

// (4) You MUST implement this: fetch latest priceUpdateData blobs for the feeds
// from Pyth's Hermes / price service. Each blob is typically a Uint8Array.
// The array can include multiple feeds at once.
async function fetchPriceUpdateData(): Promise<Uint8Array[]> {
  // TODO: implement real fetch to Pyth price service.
  // This is just a placeholder that returns an empty list
  // so the code compiles. An empty list will NOT work on-chain.
  return [];
}

// ---- HANDLER ----

export async function GET() {
  try {
    // 1. connect to Solana
    const connection = new Connection(RPC_URL, "confirmed");

    // 2. backend wallet
    const wallet = getBackendWallet();

    // 3. init Pyth receiver on the server
    const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

    // 4. pull latest oracle update data for the feeds we care about
    const priceUpdateData = await fetchPriceUpdateData();

    // 5. start a tx builder
    const txBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: false,
    });

    // 6. add Pyth "postPriceUpdates" instructions (creates temp accounts + writes price data)
    await txBuilder.addPostPriceUpdates(priceUpdateData);

    // 7. We now ask txBuilder for the mapping from feedID -> temp price account.
    // We do this by calling addPriceConsumerInstructions with a callback,
    // but we return [] so we DON'T add your protocol ix on the server.
    const acctMap: Record<string, string> = {};
    await txBuilder.addPriceConsumerInstructions(
      async (
        getPriceUpdateAccount: (priceFeedId: string) => PublicKey
      ) => {
        const collateralAcctPk = getPriceUpdateAccount(
          COLLATERAL_PRICE_FEED_ID
        );
        const borrowAcctPk = getPriceUpdateAccount(
          BORROW_PRICE_FEED_ID
        );

        acctMap["collateral"] = collateralAcctPk.toBase58();
        acctMap["borrow"] = borrowAcctPk.toBase58();

        // We don't want to actually append any protocol instructions here.
        // This endpoint's job is ONLY to prep oracle accounts and tell the client
        // which accounts to pass into buildBorrowTx.
        return [];
      }
    );

    // NOTE IMPORTANT:
    // At this point, txBuilder HAS the oracle-post instructions staged,
    // but we have NOT actually sent them yet.
    //
    // There are 2 patterns:
    //
    // (A) Custodial / server executes everything:
    //     - Server would ALSO insert the borrow ix here,
    //       call buildVersionedTransactions(),
    //       sign+send with user's signer (if you co-sign) or fully custodial.
    //
    // (B) Split execution (non-custodial UX):
    //     - Server PRE-PAYS rent + posts price accounts in its own tx *right now*,
    //       so those accounts exist on-chain.
    //     - Server returns those account addresses to the browser.
    //     - Browser builds its own borrow tx that just reads them.
    //
    // We'll implement (B) because you want the wallet to sign client-side.
    //
    // So we actually DO need to send the txs that create/write those accounts here,
    // or else the client tx will reference accounts that don't exist yet.
    //
    // We'll finalize & send JUST the oracle update transactions here,
    // WITHOUT your borrow ix.

    const unsignedOracleTxs = await txBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 50_000,
    });

    // sign+send them with the backend wallet
    const sigs = await pythSolanaReceiver.provider.sendAll(
      unsignedOracleTxs,
      { skipPreflight: true }
    );

    // sigs is usually an array of signatures; we don't strictly need to return it,
    // but it can help debugging in the client
    return NextResponse.json({
      ok: true,
      signature: Array.isArray(sigs) ? sigs[0] : sigs,
      priceUpdateCollateral: acctMap["collateral"],
      priceUpdateBorrow: acctMap["borrow"],
    });
  } catch (err: any) {
    console.error("pyth-price-accounts error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? "internal error",
      },
      { status: 500 }
    );
  }
}

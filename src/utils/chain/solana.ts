"use client";

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createRevokeInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createApproveInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

// ---------------------------------
// Constants / Program IDs
// ---------------------------------

export const CORE_ROUTER_PROGRAM_ID = new PublicKey(
  "FRZjMjpFPrSCeFQSEeN9DPmTd4Ny4nTpByrNvcFTbUtQ"
);

// NOTE: this is the associated token program your on-chain code uses
export const CORE_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// canonical wrapped SOL mint
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// ---------------------------------
// Utils
// ---------------------------------

function makeReadonlyWallet(pubkey: PublicKey) {
  return {
    publicKey: pubkey,
    signTransaction: async () => {
      throw new Error("readonly");
    },
    signAllTransactions: async () => {
      throw new Error("readonly");
    },
  } as any;
}

// TextEncoder for PDA seeds
const te = new TextEncoder();

// PDA helper
const findPda = (seeds: (Uint8Array | Buffer)[]) =>
  PublicKey.findProgramAddressSync(seeds, CORE_ROUTER_PROGRAM_ID);

// little-endian u64 encoder that works in browser
const u64LE = (n: number | string | BN | bigint) => {
  const bn = BN.isBN(n) ? n : new BN(n.toString());
  return Buffer.from(bn.toArray("le", 8)); // 8-byte little-endian
};

// convert a UI amount (like "1.23 tokens") to base units (u64) for a mint with `decimals`
function toBaseUnits(amountUi: number, decimals: number): bigint {
  // NOTE: this uses JS float math; for production you may want integer string math.
  const factor = 10 ** decimals;
  const raw = Math.floor(amountUi * factor);
  return BigInt(raw);
}

// ---------------------------------
// PDA derivations (must match on-chain program)
// ---------------------------------

// market PDA = ["market", underlying_mint]
export function findMarketPda(underlyingMint: PublicKey): [PublicKey, number] {
  return findPda([te.encode("market"), underlyingMint.toBuffer()]);
}

// supply_vault PDA = ["supply_vault", market]
export function findSupplyVaultPda(market: PublicKey): [PublicKey, number] {
  return findPda([te.encode("supply_vault"), market.toBuffer()]);
}

// user account PDA = ["user_account", user, market]
// NOTE: Anchor .accounts({ userAccount: ... }) points here.
export function findUserPositionPda(
  user: PublicKey,
  marketPda: PublicKey
): [PublicKey, number] {
  return findPda([
    te.encode("user_account"),
    user.toBuffer(),
    marketPda.toBuffer(),
  ]);
}

// ---------------------------------
// Instruction discriminators (from IDL)
// ---------------------------------

// initialize_user_position (aka initialize userAccount)
const IX_INIT_USER_POS = Uint8Array.from([
  231, 139, 172, 230, 252, 49, 210, 9,
]);

// deposit(amount: u64)
const IX_DEPOSIT = Uint8Array.from([
  242, 35, 198, 137, 82, 225, 242, 182,
]);

// ---------------------------------
// Instruction builders
// ---------------------------------

/**
 * initialize_user_position
 *
 * Anchor IDL:
 *   accounts: {
 *     signer,
 *     market,
 *     userAccount,
 *     systemProgram
 *   }
 *   args: none
 */
function ixInitializeUserPosition(
  signer: PublicKey,
  market: PublicKey,
  userAccount: PublicKey
): TransactionInstruction {
  const data = Buffer.from(IX_INIT_USER_POS); // no args

  return new TransactionInstruction({
    programId: CORE_ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: false },
      { pubkey: userAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * deposit(amount: u64)
 *
 * Anchor IDL:
 *   accounts: {
 *     signer,
 *     mint,
 *     market,
 *     userTokenAccount,
 *     supplyVault,
 *     userAccount,
 *     tokenProgram,
 *     associatedTokenProgram,
 *     systemProgram
 *   }
 *   args: [ amount: u64 ]
 */
function ixDeposit(params: {
  signer: PublicKey;
  mint: PublicKey;
  market: PublicKey;
  userTokenAccount: PublicKey;
  supplyVault: PublicKey;
  userPosition: PublicKey; // maps to userAccount in IDL
  amount: bigint | BN | number | string;
}): TransactionInstruction {
  const {
    signer,
    mint,
    market,
    userTokenAccount,
    supplyVault,
    userPosition,
    amount,
  } = params;

  const data = Buffer.concat([
    Buffer.from(IX_DEPOSIT),
    u64LE(amount), // u64 arg
  ]);

  return new TransactionInstruction({
    programId: CORE_ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: supplyVault, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true }, // == userAccount in Anchor call
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: CORE_ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------
// Connection helpers
// ---------------------------------

export const RPC_ENDPOINT = clusterApiUrl("testnet");

export function getConnection() {
  const url = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

// ---------------------------------
// Balances / helpers
// ---------------------------------

export async function fetchSplTokenBalance(
  owner: PublicKey,
  mint: PublicKey,
  connection: Connection = getConnection()
): Promise<number> {
  const ata = getAssociatedTokenAddressSync(mint, owner);

  try {
    const acc = await connection.getTokenAccountBalance(ata, "confirmed");
    return Number(acc.value.amount) / 10 ** acc.value.decimals;
  } catch (e) {
    return 0;
  }
}

export async function fetchSolBalanceSOL(owner: PublicKey) {
  const conn = getConnection();
  const lamports = await conn.getBalance(owner, { commitment: "confirmed" });
  return lamports / 1_000_000_000;
}

export function lamports(amountSol: number) {
  return Math.floor(amountSol * 1_000_000_000);
}

// ---------------------------------
// Native SOL wrapping (WSOL creator)
// ---------------------------------

/**
 * Prepares instructions to:
 *  - create the user's WSOL ATA (idempotent)
 *  - transfer SOL into it
 *  - sync native
 *
 * Returns { ata, ixes }
 */
export function prepareWrapSolIxes(
  payer: PublicKey,
  owner: PublicKey,
  amountLamports: number
): { ata: PublicKey; ixes: TransactionInstruction[] } {
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
  const ixes: TransactionInstruction[] = [];

  // 1. Create ATA if missing (idempotent instruction)
  ixes.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ata,
      owner,
      NATIVE_MINT
    )
  );

  // 2. Transfer SOL -> ATA (WSOL account just holds lamports)
  ixes.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: ata,
      lamports: amountLamports,
    })
  );

  // 3. Sync native balance into SPL accounting
  ixes.push(createSyncNativeInstruction(ata));

  return { ata, ixes };
}

// ---------------------------------
// High-level builder: deposit any mint (including SOL/WSOL)
// ---------------------------------

/**
 * High-level deposit builder (single Transaction):
 *
 * Matches Anchor flow:
 *
 * await program.methods
 *   .deposit(amountBaseUnits)
 *   .accounts({
 *     signer: owner,
 *     mint,
 *     market,
 *     userTokenAccount,
 *     supplyVault,
 *     userAccount,
 *     tokenProgram: TOKEN_PROGRAM_ID,
 *     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
 *     systemProgram: SystemProgram.programId,
 *   })
 *   .rpc();
 *
 * Steps in the built tx:
 *   1. (If mint is native SOL/WSOL) wrap SOL into WSOL for `amount`
 *      Otherwise, create ATA idempotently for SPL token
 *   2. Initialize userAccount PDA if it doesn't exist
 *   3. Approve market PDA as delegate for exactly that amount
 *   4. Call deposit(amount)
 *   5. Revoke delegate (optional)
 *
 * Inputs:
 *   - owner: wallet pubkey
 *   - mint: token mint to deposit
 *   - amountUi: human-readable amount, e.g. 1.5
 *   - mintDecimals: mint decimals, e.g. 9 for SOL/WSOL
 *
 * Returns:
 *   {
 *     tx,
 *     accounts: {
 *       market,
 *       supplyVault,
 *       userAccount,
 *       userTokenAccount,
 *       delegate, // == market
 *     }
 *   }
 */
export async function buildDepositSolTx({
  owner,
  mint,
  amountUi,
  mintDecimals,
  connection = getConnection(),
  autoRevoke = true,
}: {
  owner: PublicKey;
  mint: PublicKey; // <-- this is the mint address you pass in (mockMint2)
  amountUi: number;
  mintDecimals: number;
  connection?: Connection;
  autoRevoke?: boolean;
}): Promise<{
  tx: Transaction;
  accounts: {
    market: PublicKey;
    supplyVault: PublicKey;
    userAccount: PublicKey;
    userTokenAccount: PublicKey;
    delegate: PublicKey;
  };
}> {
  // 1. derive PDAs for this mint
  const [market] = findMarketPda(mint);
  const [supplyVault] = findSupplyVaultPda(market);
  const [userAccount] = findUserPositionPda(owner, market); // maps to userAccount in Anchor

  // user's ATA for this mint
  const userTokenAccount = getAssociatedTokenAddressSync(mint, owner);

  // convert UI amount (ex: 1.23 tokens) into base units (u64) using decimals
  const amountBaseUnits = toBaseUnits(amountUi, mintDecimals);

  const ixs: TransactionInstruction[] = [];
  ixs.push(
    ixDeposit({
      signer: owner,
      mint,
      market,
      userTokenAccount,
      supplyVault,
      userPosition: userAccount, // this is userAccount in Anchor
      amount: amountBaseUnits,
    })
  );

  // 6. Optionally revoke the delegate so it can't spend again later
  if (autoRevoke) {
    ixs.push(createRevokeInstruction(userTokenAccount, owner));
  }

  // 7. finalize tx with a recent blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);

  return {
    tx,
    accounts: {
      market,
      supplyVault,
      userAccount,
      userTokenAccount,
      delegate: market,
    },
  };
}

// ---------------------------------
// Standalone approve helper (optional)
// ---------------------------------

export function createApproveIx(params: {
  owner: PublicKey;
  ata: PublicKey;
  delegate: PublicKey;
  amountLamports: number;
}): TransactionInstruction {
  const { owner, ata, delegate, amountLamports } = params;
  return createApproveInstruction(ata, delegate, owner, BigInt(amountLamports));
}

// ---------------------------------
// Legacy convenience for SOL specifically (optional)
// ---------------------------------

export async function buildApproveAndDepositSolTx({
  owner,
  amountSol,
  connection = getConnection(),
}: {
  owner: PublicKey;
  amountSol: number;
  connection?: Connection;
}) {
  // This is mostly for backwards compatibility.
  // Uses WSOL mint + 9 decimals.
  return buildDepositSolTx({
    owner,
    mint: NATIVE_MINT,
    amountUi: amountSol,
    mintDecimals: 9,
    connection,
    autoRevoke: true,
  });
}

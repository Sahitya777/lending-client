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
  "G4MitBcWMKCVaPibM4Y1AQ3nfPcQDygGRcYryKfs2XYK"
);

// The program appears to use the market PDA as the transfer authority when pulling funds.
// We no longer try to approve the program ID directly. We approve the market PDA on demand.
export const CORE_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// This is Solana's wrapped SOL mint. Same as NATIVE_MINT,
// but we keep an explicit constant for clarity in UI code.
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// ---------------------------------
// Utils
// ---------------------------------

function makeReadonlyWallet(pubkey: PublicKey) {
  // optional helper if you ever need AnchorProvider-style Wallet without signing
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
const u64LE = (n: number | string | BN) => {
  const bn = BN.isBN(n) ? n : new BN(n);
  return Buffer.from(bn.toArray("le", 8)); // 8-byte little-endian
};

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

// user position PDA = ["user_account", user, market]
// NOTE: seeds use *market PDA*, NOT the mint pubkey.
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

// initialize_user_position
const IX_INIT_USER_POS = Uint8Array.from([
  231, 139, 172, 230, 252, 49, 210, 9,
]);

// deposit
const IX_DEPOSIT = Uint8Array.from([
  242, 35, 198, 137, 82, 225, 242, 182,
]);

// ---------------------------------
// Instruction builders
// ---------------------------------

/**
 * initialize_user_position
 *
 * Anchor IDL says:
 *   accounts: {
 *     signer,
 *     market,
 *     userAccount,
 *     systemProgram
 *   }
 *   args: none
 *
 * So data = discriminator only. No args.
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
 * Anchor IDL says:
 *   accounts: {
 *     signer,
 *     mint,
 *     market,
 *     userTokenAccount,
 *     supplyVault,
 *     userPosition,
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
  userPosition: PublicKey;
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
      { pubkey: userPosition, isSigner: false, isWritable: true },
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
  const url = process.env.NEXT_PUBLIC_RPC || "https://api.testnet.solana.com";
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

  // We'll attempt to fetch the token account + mint info.
  // If the ATA doesn't exist, this will throw and we'll treat it as 0.
  try {
    const acc = await connection.getTokenAccountBalance(ata, "confirmed");
    // acc.value.amount is string of base units (no decimals)
    // acc.value.decimals is decimals for this mint
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
  // convert SOL to lamports
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
// Build the full "deposit SOL (or any mint)" tx
// ---------------------------------

/**
 * High-level deposit builder for the UI:
 *
 * - wrap SOL into WSOL if depositing native SOL
 * - initialize user position PDA if not created yet
 * - approve the market PDA as token delegate for exactly `amountLamports`
 * - call deposit(amount)
 * - revoke the delegate
 *
 * Returns:
 *   { tx, accounts: { market, supplyVault, userPosition, userTokenAccount, delegate } }
 *
 */
export async function buildDepositSolTx(
  {
    owner,
    amountSol,
    connection = getConnection(),
    underlyingMint = new PublicKey('Em9FJok1Bvfcw9JdjUAENUgqRzGKMYHMX9aNQkPG3JkV'), // default is native SOL/WSOL
    autoRevoke = true,
  }: {
    owner: PublicKey;
    amountSol: number;
    connection?: Connection;
    underlyingMint?: PublicKey;
    autoRevoke?: boolean;
  }
): Promise<{
  tx: Transaction;
  accounts: {
    market: PublicKey;
    supplyVault: PublicKey;
    userPosition: PublicKey;
    userTokenAccount: PublicKey;
    delegate: PublicKey;
  };
}> {
  // derive all the PDAs this program expects
  const [market] = findMarketPda(underlyingMint);
  const [supplyVault] = findSupplyVaultPda(market);
  const [userPosition] = findUserPositionPda(owner, market);

  // user's ATA for this mint
  const userTokenAccount = getAssociatedTokenAddressSync(
    underlyingMint,
    owner
  );

  const amountLamports = lamports(amountSol);
  const ixs: TransactionInstruction[] = [];

  // 1. If depositing SOL, wrap it into WSOL first
  // if (underlyingMint.equals(NATIVE_MINT)) {
  //   const { ixes } = prepareWrapSolIxes(owner, owner, amountLamports);
  //   ixs.push(...ixes);
  // }

  // 2. Initialize user position PDA if it doesn't exist yet
  const upInfo = await connection.getAccountInfo(userPosition, "confirmed");
  console.log(upInfo,'param')
  if (!upInfo) {
    ixs.push(ixInitializeUserPosition(owner, market, userPosition));
  }

  // 3. Approve the `market` PDA as delegate for this token account.
  //
  // Why `market`? The on-chain program can sign as this PDA via invoke_signed,
  // and it already has `market` in the account list for deposit.
  //
  // NOTE: Phantom will bundle all ixs into 1 tx, so approval + deposit + revoke
  // happen atomically.
  ixs.push(
    createApproveInstruction(
      userTokenAccount,
      market, // delegate PDA
      owner, // owner authority of ATA
      BigInt(amountLamports)
    )
  );

  // 4. deposit (amount in base units = lamports for SOL, raw decimals for tokens)
  ixs.push(
    ixDeposit({
      signer: owner,
      mint: underlyingMint,
      market,
      userTokenAccount,
      supplyVault,
      userPosition,
      amount: BigInt(amountLamports),
    })
  );

  // 5. Optionally revoke delegate so PDA can't spend again
  if (autoRevoke) {
    ixs.push(createRevokeInstruction(userTokenAccount, owner));
  }

  // recent blockhash
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
      userPosition,
      userTokenAccount,
      delegate: market,
    },
  };
}

// ---------------------------------
// (Optional) generic approve helper if you need standalone approvals
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
// Optional convenience for building a raw "wrap -> approve -> deposit" tx
// (Only keep if you still need it outside buildDepositSolTx)
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
  // This helper is mostly superseded by buildDepositSolTx,
  // but we'll keep it here if you still rely on it.
  return buildDepositSolTx({
    owner,
    amountSol,
    connection,
    underlyingMint: NATIVE_MINT,
    autoRevoke: true,
  });
}

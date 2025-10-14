// chain/solana.ts
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
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createApproveInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";

// ----------- CONFIG -----------
export const RPC_ENDPOINT = clusterApiUrl('testnet');

// REPLACE with your real IDs
export const PROTOCOL_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
export const PROTOCOL_VAULT_PDA = new PublicKey("11111111111111111111111111111111");
// If your program uses a PDA delegate to pull funds, set it here (or pass in)
export const PROTOCOL_DELEGATE = PROTOCOL_PROGRAM_ID;
// --------------------------------

export function getConnection() {
    const url = process.env.NEXT_PUBLIC_RPC || 'https://api.testnet.solana.com';
  return new Connection(url, "confirmed");
}

export async function fetchSplTokenBalance(
  owner: PublicKey,
  mint: PublicKey,
  connection: Connection = getConnection()
): Promise<number> {
  // Derive the user's ATA for this mint
  const ata = getAssociatedTokenAddressSync(mint, owner);

  // Quick existence check: getAccount throws if not found
  try {
    const acc = await getAccount(connection, ata, "confirmed");
    // Read token's decimals (cache this per mint in prod)
    const mintInfo = await getMint(connection, mint, "confirmed");
    const decimals = mintInfo.decimals;

    // acc.amount is a bigint of base units
    const raw = Number(acc.amount);
    return raw / Math.pow(10, decimals);
  } catch (e) {
    // No ATA or not initialized → balance is 0
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

/**
 * Ensure we have an ATA for WSOL and that it holds `amountLamports` native SOL (wrapped).
 * Returns the WSOL ATA and the set of setup instructions (create ATA if missing, transfer SOL, sync native).
 */
export function prepareWrapSolIxes(
  payer: PublicKey,
  owner: PublicKey,
  amountLamports: number
) {
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
  const ixes: TransactionInstruction[] = [];

  // Create the ATA if missing (idempotent)
  ixes.push(
    createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, NATIVE_MINT)
  );

  // Transfer SOL -> ATA (WSOL account holds lamports)
  ixes.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: ata,
      lamports: amountLamports,
    })
  );

  // Sync native so the token account reflects the lamport balance
  ixes.push(createSyncNativeInstruction(ata));

  return { ata, ixes };
}

/**
 * Approve your protocol (or its PDA delegate) as a token delegate on WSOL.
 */
export function createApproveIx(params: {
  owner: PublicKey;
  ata: PublicKey;
  delegate: PublicKey;
  amountLamports: number;
}) {
  const { owner, ata, delegate, amountLamports } = params;
  return createApproveInstruction(ata, delegate, owner, BigInt(amountLamports));
}

/**
 * Build your protocol's "deposit" instruction.
 * TODO: Replace keys and data layout per your actual on-chain program.
 */
export function buildDepositIx(params: { user: PublicKey; userWsolAta: PublicKey }) {
  const { user, userWsolAta } = params;

  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: userWsolAta, isSigner: false, isWritable: true },
    { pubkey: PROTOCOL_VAULT_PDA, isSigner: false, isWritable: true },
    // Add any other required accounts (e.g., token program, system program, PDAs...)
  ];

  // Example discriminator (change to your program’s layout)
  const data = Buffer.from([0x01]); // 0x01 => "deposit" variant (example)

  return new TransactionInstruction({
    programId: PROTOCOL_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the transaction: wrap SOL -> approve delegate -> deposit
 * NOTE: This RETURNS a Transaction ready to be signed/sent by the wallet.
 */
export async function buildApproveAndDepositSolTx(opts: {
  owner: PublicKey;
  amountSol: number;
  delegate?: PublicKey;
}) {
  const { owner, amountSol, delegate = PROTOCOL_DELEGATE } = opts;
  const connection = getConnection();

  const amountLamports = lamports(amountSol);
  const { ata, ixes: wrapIxes } = prepareWrapSolIxes(owner, owner, amountLamports);
  const approveIx = createApproveIx({ owner, ata, delegate, amountLamports });
  const depositIx = buildDepositIx({ user: owner, userWsolAta: ata });

  const tx = new Transaction().add(...wrapIxes, approveIx, depositIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  return { tx, ata };
}

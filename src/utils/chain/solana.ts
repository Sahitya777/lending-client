// chain/solana.ts
"use client";

import {
  Connection,
  LAMPORTS_PER_SOL,
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
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

function makeReadonlyWallet(pubkey: PublicKey): Wallet {
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
// ---- add near top if not present ----
const te = new TextEncoder();
const findPda = (seeds: (Uint8Array | Buffer)[]) =>
  PublicKey.findProgramAddressSync(seeds, CORE_ROUTER_PROGRAM_ID);

// core_router program + ATP ids
export const CORE_ROUTER_PROGRAM_ID = new PublicKey(
  "4i28wYuQQVnbAMZekQryDTb4nAmEcDwBVRH5kZPjgRiA"
);
export const CORE_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// before (breaks in browsers)
// const u64LE = (n: number | bigint) => {
//   const buf = Buffer.alloc(8);
//   buf.writeBigUInt64LE(BigInt(n));
//   return buf;
// };

// after (works in the browser)
const u64LE = (n: number | string | BN) => {
  const bn = BN.isBN(n) ? n : new BN(n);
  return Buffer.from(bn.toArray("le", 8)); // 8-byte little-endian
};

// Discriminators from your IDL
const IX_INIT_USER_POS = Uint8Array.from([231, 139, 172, 230, 252, 49, 210, 9]);
const IX_DEPOSIT = Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]);

function ixInitializeUserPosition(
  signer: PublicKey,
  userAccount: PublicKey,
  marketMint: PublicKey
) {
  const data = Buffer.concat([
    Buffer.from(IX_INIT_USER_POS),
    marketMint.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: CORE_ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: userAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function ixDeposit(params: {
  signer: PublicKey;
  mint: PublicKey;
  market: PublicKey;
  userTokenAccount: PublicKey;
  supplyVault: PublicKey;
  userPosition: PublicKey;
  amount: bigint;
}) {
  const {
    signer,
    mint,
    market,
    userTokenAccount,
    supplyVault,
    userPosition,
    amount,
  } = params;
  const data = Buffer.concat([Buffer.from(IX_DEPOSIT), u64LE(amount)]);
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

/**
 * Build deposit TX for core_router:
 * - (WSOL only) wrap SOL
 * - init user_position if missing
 * - deposit(amount)
 */
export async function buildDepositSolTx({
  owner,
  amountSol,
  connection = getConnection(),
  underlyingMint = NATIVE_MINT, // WSOL by default
}: {
  owner: PublicKey;
  amountSol: number;
  connection?: Connection;
  underlyingMint?: PublicKey;
}) {
  const [market] = findMarketPda(underlyingMint);
  const [supplyVault] = findSupplyVaultPda(market);
  const [userPosition] = findUserPositionPda(owner, underlyingMint);
  const userTokenAccount = getAssociatedTokenAddressSync(underlyingMint, owner);

  const amountLamports = lamports(amountSol);
  const ixs: TransactionInstruction[] = [];

  // Wrap SOL if depositing WSOL
  if (underlyingMint.equals(NATIVE_MINT)) {
    const { ixes } = prepareWrapSolIxes(owner, owner, amountLamports);
    ixs.push(...ixes);
  }

  // Initialize user position if missing
  const upInfo = await connection.getAccountInfo(userPosition, "confirmed");
  if (!upInfo) {
    ixs.push(ixInitializeUserPosition(owner, userPosition, underlyingMint));
  }

  // Deposit
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
  console.log("2");

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);

  return {
    tx,
    accounts: { market, supplyVault, userPosition, userTokenAccount },
  };
}

export function findMarketPda(underlyingMint: PublicKey) {
  return findPda([te.encode("market"), underlyingMint.toBuffer()]);
}
export function findSupplyVaultPda(market: PublicKey) {
  return findPda([te.encode("supply_vault"), market.toBuffer()]);
}
export function findUserPositionPda(user: PublicKey, marketMint: PublicKey) {
  return findPda([
    te.encode("user_account"),
    user.toBuffer(),
    marketMint.toBuffer(),
  ]);
}

// ----------- CONFIG -----------
export const RPC_ENDPOINT = clusterApiUrl("testnet");

// REPLACE with your real IDs
export const PROTOCOL_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111"
);
export const PROTOCOL_VAULT_PDA = new PublicKey(
  "11111111111111111111111111111111"
);
// If your program uses a PDA delegate to pull funds, set it here (or pass in)
export const PROTOCOL_DELEGATE = PROTOCOL_PROGRAM_ID;
// --------------------------------

export function getConnection() {
  const url = process.env.NEXT_PUBLIC_RPC || "https://api.testnet.solana.com";
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
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ata,
      owner,
      NATIVE_MINT
    )
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
export function buildDepositIx(params: {
  user: PublicKey;
  userWsolAta: PublicKey;
}) {
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
  const { ata, ixes: wrapIxes } = prepareWrapSolIxes(
    owner,
    owner,
    amountLamports
  );
  const approveIx = createApproveIx({ owner, ata, delegate, amountLamports });
  const depositIx = buildDepositIx({ user: owner, userWsolAta: ata });

  const tx = new Transaction().add(...wrapIxes, approveIx, depositIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  return { tx, ata };
}

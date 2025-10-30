import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
  Keypair,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Program, AnchorProvider, BN, Idl, Wallet } from "@coral-xyz/anchor";
import coreRouterIdl from "../../blockchain/idl/core_router.json"; // <- paste that JSON there
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
export const PROGRAM_ID = new PublicKey(
  "FRZjMjpFPrSCeFQSEeN9DPmTd4Ny4nTpByrNvcFTbUtQ"
);

const CUSTOM_TOKEN_PROGRAM_ID = new PublicKey(
  Uint8Array.from([
    140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,
    11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89,
  ])
);

const DISCRIMINATOR = {
  Loan: Buffer.from([20, 195, 70, 117, 165, 227, 182, 1]),
  // Market: [219, 190, 213, 55, 0, 227, 198, 154], // not needed here
  // UserPosition: [251, 248, 209, 245, 83, 234, 17, 27], // not needed here
};

const DEPOSIT_DISCRIMINATOR = Buffer.from([
  242, 35, 198, 137, 82, 225, 242, 182,
]);

const WITHDRAW_DISCRIMINATOR = Buffer.from([
  183, 18, 70, 156, 148, 109, 161, 34,
]);

const BORROW_DISCRIMINATOR = Buffer.from([
  228, 253, 131, 202, 207, 116, 89, 18,
]);

const LOAN_DISCRIMINATOR = Buffer.from([20, 195, 70, 117, 165, 227, 182, 1]);

const REPAY_DISCRIMINATOR = Buffer.from([234, 103, 67, 82, 208, 234, 219, 166]);

const MARKET_DISCRIMINATOR = Buffer.from([219,190,213,55,0,227,198,154]); // from IDL

const MARKET_MINT_OFFSET = 8; // first field after 8-byte discriminator

export async function fetchMarketMint(
  connection: Connection,
  marketPda: PublicKey
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(marketPda, "confirmed");
  if (!info?.data) throw new Error("Market account not found");
  const data = Buffer.from(info.data);
  if (!data.slice(0, 8).equals(MARKET_DISCRIMINATOR)) {
    throw new Error("Not a Market account");
  }
  return new PublicKey(data.slice(MARKET_MINT_OFFSET, MARKET_MINT_OFFSET + 32));
}

// get protocol-custodied token amount (ui + raw)
export async function fetchProtocolHeldTokenBalance({
  connection,
  owner,
  mint,
}: {
  connection: Connection;
  owner: PublicKey;
  mint: PublicKey;
}) {
  const [userTokenAccountPda] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    CUSTOM_TOKEN_PROGRAM_ID
  );

  const bal = await connection.getTokenAccountBalance(userTokenAccountPda);

  return {
    account: userTokenAccountPda.toBase58(),
    rawAmount: bal.value.amount,        // string in base units
    decimals: bal.value.decimals,       // number
    uiAmount: bal.value.uiAmount,       // number | null
    uiAmountString: bal.value.uiAmountString, // string
  };
}



function u64Le(bn: BN) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32LE(bn.and(new BN("ffffffff", 16)).toNumber(), 0);
  buf.writeUInt32LE(bn.shrn(32).toNumber(), 4);
  return buf;
}

function uiAmountToBaseUnits(amountUi: number, decimals: number): BN {
  const [wholeStr, fracStrRaw = ""] = amountUi.toString().split(".");
  const fracStr = fracStrRaw.padEnd(decimals, "0").slice(0, decimals);

  const wholeBn = new BN(wholeStr || "0");
  const fracBn = new BN(fracStr || "0");

  const tenPow = new BN(10).pow(new BN(decimals));

  return wholeBn.mul(tenPow).add(fracBn);
}

// UPDATED to not use deprecated ctor signature
export async function buildDepositTx({
  owner,
  mint,
  amountUi,
  mintDecimals,
  connection,
}: {
  owner: PublicKey;
  mint: PublicKey;
  amountUi: number;
  mintDecimals: number;
  connection: any;
}) {
  // derive PDAs same as before
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [supplyVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("supply_vault"), marketPda.toBuffer()],
    PROGRAM_ID
  );

  const [userAccountPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_account"),
      owner.toBuffer(),
      marketPda.toBuffer(),
    ],
    PROGRAM_ID
  );

  const [userTokenAccountPda] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    CUSTOM_TOKEN_PROGRAM_ID
  );

  // encode amount
  const amountBn = uiAmountToBaseUnits(amountUi, mintDecimals);
  const data = Buffer.concat([DEPOSIT_DISCRIMINATOR, u64Le(amountBn)]);

  // build instruction
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: userTokenAccountPda, isSigner: false, isWritable: true },
    { pubkey: supplyVaultPda, isSigner: false, isWritable: true },
    { pubkey: userAccountPda, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  return {
    ix,
    derived: {
      marketPda,
      supplyVaultPda,
      userAccountPda,
      userTokenAccountPda,
    },
  };
}

export async function buildWithdrawTx({
  owner,          // wallet pubkey (signer)
  mint,           // PublicKey of the asset mint you're withdrawing
  sharesUi,       // number in "UI units" of shares (see note below)
  shareDecimals,  // decimals for the *share token*, not necessarily mint decimals
}: {
  owner: PublicKey;
  mint: PublicKey;
  sharesUi: number;
  shareDecimals: number;
}) {
  //
  // Derive PDAs to match withdraw accounts
  //

  // market PDA: ["market", mint]
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), mint.toBuffer()],
    PROGRAM_ID
  );

  // supplyVault PDA: ["supply_vault", market]
  const [supplyVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("supply_vault"), marketPda.toBuffer()],
    PROGRAM_ID
  );

  // userTokenAccount PDA:
  // seeds = [ signer, tokenProgram, mint ]
  // program = CUSTOM_TOKEN_PROGRAM_ID (same custom program id as deposit)
  const [userTokenAccountPda] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    CUSTOM_TOKEN_PROGRAM_ID
  );

  // userPosition PDA:
  // seeds = ["user_account", signer, market]
  // (IDL calls it "userPosition" here, but seeds match what was "user_account" in deposit)
  const [userPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_account"),
      owner.toBuffer(),
      marketPda.toBuffer(),
    ],
    PROGRAM_ID
  );

  //
  // Encode withdraw args
  //
  // withdraw args = { shares: u64 }
  // We treat sharesUi like a UI number and scale by shareDecimals into base units for u64.
  const sharesBn = uiAmountToBaseUnits(sharesUi, shareDecimals);
  const data = Buffer.concat([
    WITHDRAW_DISCRIMINATOR,
    u64Le(sharesBn),
  ]);

  //
  // Build instruction with EXACT account order from IDL:
  //
  // 0 signer (mut, signer)
  // 1 mint
  // 2 market (mut)
  // 3 supplyVault (mut)
  // 4 userTokenAccount (mut)
  // 5 userPosition (mut)
  // 6 tokenProgram
  // 7 associatedTokenProgram
  // 8 systemProgram
  //
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },          // signer
    { pubkey: mint, isSigner: false, isWritable: false },         // mint
    { pubkey: marketPda, isSigner: false, isWritable: true },     // market
    { pubkey: supplyVaultPda, isSigner: false, isWritable: true },// supplyVault
    { pubkey: userTokenAccountPda, isSigner: false, isWritable: true }, // userTokenAccount
    { pubkey: userPositionPda, isSigner: false, isWritable: true },     // userPosition
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // tokenProgram
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associatedTokenProgram
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },     // systemProgram
  ];

  const ix = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  return {
    ix,
    derived: {
      marketPda,
      supplyVaultPda,
      userTokenAccountPda,
      userPositionPda,
    },
  };
}

export async function buildBorrowTx({
  borrower,
  collateralMint,
  borrowMint,
  sharesAmountUi,
  borrowAmountUi,
  collateralMintDecimals,
  borrowMintDecimals,
  priceUpdateCollateral,
  priceUpdateBorrow,
  connection, // kept for symmetry with deposit
}: {
  borrower: PublicKey;
  collateralMint: PublicKey;
  borrowMint: PublicKey;
  sharesAmountUi: number;
  borrowAmountUi: number;
  collateralMintDecimals: number;
  borrowMintDecimals: number;
  priceUpdateCollateral: PublicKey; // "price_update_col" (PriceUpdateV2 account for collateral asset)
  priceUpdateBorrow: PublicKey; // "price_update_borrow" (PriceUpdateV2 account for borrow asset)
  connection: any;
}) {
  //
  // Derive PDAs exactly per IDL
  //
  const [protocolStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_state")],
    PROGRAM_ID
  );

  const [collateralMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), collateralMint.toBuffer()],
    PROGRAM_ID
  );

  const [borrowMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), borrowMint.toBuffer()],
    PROGRAM_ID
  );

  const [collateralPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_account"),
      borrower.toBuffer(),
      collateralMarketPda.toBuffer(),
    ],
    PROGRAM_ID
  );

  const [loanPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("loan"),
      collateralMarketPda.toBuffer(),
      borrowMarketPda.toBuffer(),
      borrower.toBuffer(),
    ],
    PROGRAM_ID
  );

  //
  // Encode args: shares_amount, borrow_amount (both u64 LE)
  //
  const sharesAmountBn = uiAmountToBaseUnits(
    sharesAmountUi,
    collateralMintDecimals
  );
  const borrowAmountBn = uiAmountToBaseUnits(
    borrowAmountUi,
    borrowMintDecimals
  );

  const data = Buffer.concat([
    BORROW_DISCRIMINATOR,
    u64Le(sharesAmountBn),
    u64Le(borrowAmountBn),
  ]);

  //
  // Accounts in exact IDL order
  //
  const keys = [
    // borrower
    { pubkey: borrower, isSigner: true, isWritable: true },

    // collateral_mint
    { pubkey: collateralMint, isSigner: false, isWritable: false },

    // borrow_mint
    { pubkey: borrowMint, isSigner: false, isWritable: false },

    // protocol_state
    { pubkey: protocolStatePda, isSigner: false, isWritable: true },

    // collateral_market
    { pubkey: collateralMarketPda, isSigner: false, isWritable: true },

    // borrow_market
    { pubkey: borrowMarketPda, isSigner: false, isWritable: true },

    // collateral_position
    { pubkey: collateralPositionPda, isSigner: false, isWritable: true },

    // loan
    { pubkey: loanPda, isSigner: false, isWritable: true },

    // token_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

    // price_update_col
    { pubkey: priceUpdateCollateral, isSigner: false, isWritable: false },

    // price_update_borrow
    { pubkey: priceUpdateBorrow, isSigner: false, isWritable: false },

    // system_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  return {
    ix,
    derived: {
      protocolStatePda,
      collateralMarketPda,
      borrowMarketPda,
      collateralPositionPda,
      loanPda,
    },
  };
}

export async function buildRepayTx({
  borrower,
  collateralMint,
  borrowMint,
  repayAmountUi,
  borrowMintDecimals,
}: {
  borrower: PublicKey;
  collateralMint: PublicKey;
  borrowMint: PublicKey;
  repayAmountUi: number;
  borrowMintDecimals: number;
}) {
  //
  // Derive PDAs exactly per IDL
  //
  const [collateralMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), collateralMint.toBuffer()],
    PROGRAM_ID
  );

  const [borrowMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), borrowMint.toBuffer()],
    PROGRAM_ID
  );

  const [loanPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("loan"),
      collateralMarketPda.toBuffer(),
      borrowMarketPda.toBuffer(),
      borrower.toBuffer(),
    ],
    PROGRAM_ID
  );

  const [userPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_account"),
      borrower.toBuffer(),
      collateralMarketPda.toBuffer(),
    ],
    PROGRAM_ID
  );

  const [supplyVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("supply_vault"), borrowMarketPda.toBuffer()],
    PROGRAM_ID
  );

  // ATA for the borrow *underlying* mint (as per IDL: seeds use borrow_market.mint)
  const userTokenAccount = getAssociatedTokenAddressSync(
    borrowMint,
    borrower,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  //
  // Encode args: repay_amount (u64 LE)
  //
  const repayAmountBn = uiAmountToBaseUnits(repayAmountUi, borrowMintDecimals);
  const data = Buffer.concat([REPAY_DISCRIMINATOR, u64Le(repayAmountBn)]);

  //
  // Accounts in exact IDL order
  //
  const keys = [
    // borrower (signer)
    { pubkey: borrower, isSigner: true, isWritable: true },

    // mint (borrow underlying mint)
    { pubkey: borrowMint, isSigner: false, isWritable: false },

    // loan
    { pubkey: loanPda, isSigner: false, isWritable: true },

    // collateral_market
    { pubkey: collateralMarketPda, isSigner: false, isWritable: true },

    // borrow_market
    { pubkey: borrowMarketPda, isSigner: false, isWritable: true },

    // user_position (PDA over borrower + collateral_market)
    { pubkey: userPositionPda, isSigner: false, isWritable: true },

    // user_token_account (ATA for borrower & borrow_market.mint)
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },

    // supply_vault (for borrow_market)
    { pubkey: supplyVaultPda, isSigner: false, isWritable: true },

    // token_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

    // associated_token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

    // system_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  return {
    ix,
    derived: {
      collateralMarketPda,
      borrowMarketPda,
      loanPda,
      userPositionPda,
      userTokenAccount,
      supplyVaultPda,
    },
  };
}

const CORE_PROGRAM_ERRORS: Record<number, string> = {
  6000: "depositTooSmall: Deposit amount below minimum threshold",
  6001: "depositTooLarge: Deposit amount exceeds maximum allowed",
  6002: "borrowTooSmall: Borrow amount below minimum threshold",
  6003: "borrowTooLarge: Borrow amount exceeds maximum allowed",
  6004: "insufficientLiquidity: Insufficient liquidity in supply vault",
  6005: "ltvExceeded: Loan-to-Value ratio exceeds maximum allowed",
  6006: "unhealthyPosition: Health factor below liquidation threshold",
  6007: "insufficientCollateral: Not enough unlocked collateral",
  6008: "invalidLoan: Loan does not exist or not owned by user",
  6009: "mathOverflow: Mathematical overflow occurred",
  6010: "marketPaused: Market is paused",
  6011: "insufficientFreeRTokens: Insufficient free rTokens to lock",
  6012: "withdrawLimitExceeded: Withdraw exceeds daily limit (20% of reserves)",
  6013: "invalidMarket: Invalid market for the given asset",
  6014: "unauthorized: unauthorized",
  6015: "repayAmountTooSmall: Repay amount exceeds outstanding borrow",
};

export function extractAnchorError(logs: string[] | null | undefined) {
  if (!logs) return null;

  // Look for a line like: "Program ... failed: custom program error: 0x1774"
  const line = logs.find(l => l.includes("custom program error"));
  if (!line) return null;

  // pull the hex out
  const match = line.match(/custom program error: (0x[0-9a-fA-F]+)/);
  if (!match) return null;

  const hexStr = match[1]; // e.g. "0x1774"
  const codeDec = parseInt(hexStr, 16); // -> 6004

  return {
    code: codeDec,
    meaning: CORE_PROGRAM_ERRORS[codeDec] || "Unknown Anchor error",
    rawLine: line,
  };
}


const USER_POSITION_SEED = "user_account";

// little-endian readers
function readU64LE(buf: Buffer, offset: number): bigint {
  // 8 bytes
  let x = BigInt(0);
  for (let i = 0; i < 8; i++) {
    x |= BigInt(buf[offset + i]) << BigInt(8 * i);
  }
  return x;
}

function readI64LE(buf: Buffer, offset: number): bigint {
  // read as unsigned first
  let x = readU64LE(buf, offset);
  // if highest bit of 64-bit is set, treat as negative two's complement
  const TWO_POW_64 = BigInt(1) << BigInt(64);
  const SIGN_BIT = BigInt(1) << BigInt(63);
  if (x & SIGN_BIT) {
    x = x - TWO_POW_64;
  }
  return x; // BigInt signed
}

function readU128LE(buf: Buffer, offset: number): bigint {
  // 16 bytes
  let x = BigInt(0);
  for (let i = 0; i < 16; i++) {
    x |= BigInt(buf[offset + i]) << BigInt(8 * i);
  }
  return x;
}

const toUiNumber = (v: bigint) => {
  const n = Number(v);
  // If it overflows JS safe integer, return NaN to signal caller to handle formatting
  return Number.isSafeInteger(n) ? n : NaN;
};

// derive market PDA: seeds = ["market", marketMint]
function deriveMarketPda(marketMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketMint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// derive user position PDA: seeds = ["user_account", owner, marketPda]
function deriveUserPositionPda(owner: PublicKey, marketPda: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_account"),
      owner.toBuffer(),
      marketPda.toBuffer(),
    ],
    PROGRAM_ID
  );
  return pda;
}

export async function fetchUserPositionViewRawWeb3(args: {
  owner: PublicKey;        // user's wallet pubkey
  marketMint: PublicKey;   // mint for this market (same one you're passing into deposit)
  connection: Connection;
  commitment?: "processed" | "confirmed" | "finalized";
}) {
  const {
    owner,
    marketMint,
    connection,
    commitment = "confirmed",
  } = args;

  // 1. derive PDAs exactly like your code
  const marketPda = deriveMarketPda(marketMint);
  const userPosPda = deriveUserPositionPda(owner, marketPda);

  // 2. pull account data directly
  const info = await connection.getAccountInfo(userPosPda, commitment);

  if (!info || !info.data || info.data.length === 0) {
    // account not initialized yet -> treat as empty position
    return {
      pda: userPosPda,
      // these BigInts are zero
      depositedSharesRaw: 0,
      lockedCollateralRaw: 0,
      borrowedSharesRaw: 0,
      depositIndexRaw: 0,
      borrowIndexRaw: 0,
      bump: 0,
      // helpful for UI
      depositedSharesUi: 0,
      borrowSharesUi:0,
      initialized: false,
    };
  }

  const data = Buffer.from(info.data);

  // We now decode based on the layout table above.

  // 0..8   discriminator, we can ignore for now
  // 8..40  user pubkey
  const userPkBytes = data.slice(8, 40);
  const userPk = new PublicKey(userPkBytes);

  // 40..72 market pubkey
  const marketPkBytes = data.slice(40, 72);
  const marketPk = new PublicKey(marketPkBytes);

  // 72..80 deposited_shares (u64 LE)
  const depositedShares = readU64LE(data, 72);

  // 80..88 locked_collateral (u64 LE)
  const lockedCollateral = readU64LE(data, 80);

  // 88..96 borrowed_shares (u64 LE)
  const borrowedShares = readU64LE(data, 88);

  // 96..112 deposit_index (u128 LE)
  const depositIndex = readU128LE(data, 96);

  // 112..128 borrow_index (u128 LE)
  const borrowIndex = readU128LE(data, 112);

  // 128 bump (u8)
  const bump = data[128];

  // For UI we usually just want depositedShares as a JS number.
  // depositedShares is a u64, so depositedShares <= ~1.8e19 in theory.
  // We'll downcast for display, but keep the bigint too.
  const depositedSharesUi = Number(depositedShares); // safe for small test balances
  const borrowSharesUi=Number(borrowedShares)
  return {
    pda: userPosPda,

    // raw fields (full precision)
    user: userPk,
    market: marketPk,
    depositedSharesRaw: depositedShares,
    lockedCollateralRaw: lockedCollateral,
    borrowedSharesRaw: borrowedShares,
    depositIndexRaw: depositIndex,
    borrowIndexRaw: borrowIndex,
    bump,

    // UI helpers
    depositedSharesUi,
    borrowSharesUi,
    initialized: true,
  };
}

export function deriveLoanPda(
  collateralMarketPda: PublicKey,
  borrowMarketPda: PublicKey,
  borrower: PublicKey
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("loan"),
      collateralMarketPda.toBuffer(),
      borrowMarketPda.toBuffer(),
      borrower.toBuffer(),
    ],
    PROGRAM_ID
  );
  return [pda, bump];
}

/** Types for decoded Loan view */
export type LoanView = {
  pda: PublicKey;

  borrower: PublicKey;
  loanId: bigint;

  collateralMarket: PublicKey;
  collateralAmountRaw: bigint;

  borrowMarket: PublicKey;
  borrowedAmountRaw: bigint;       // shares? (per your IDL it's u64)
  borrowedUnderlyingRaw: bigint;   // u64 underlying

  userPositionAccount: PublicKey;

  currentMarket: PublicKey;
  currentPositionValueRaw: bigint;

  l3Integration: PublicKey;
  l3SharesReceivedRaw: bigint;

  currentSpentU8: number;
  statusU8: number;

  createdAt: bigint; // i64 (seconds)
  updatedAt: bigint; // i64 (seconds)

  bump: number;

  // UI helpers (may be NaN if too large)
  collateralAmountUi: number;
  borrowedAmountUi: number;
  borrowedUnderlyingUi: number;
  currentPositionValueUi: number;
  l3SharesReceivedUi: number;
};

/** Fixed layout (byte offsets) for Loan account (including discriminator at 0..8) */
const LOAN_LAYOUT = {
  size: 267, // total bytes including 8-byte discriminator
  // offsets after the 8-byte discriminator:
  borrower: 8,                  // 32
  loan_id: 40,                  // 8
  collateral_market: 48,        // 32
  collateral_amount: 80,        // 8
  borrow_market: 88,            // 32
  borrowed_amount: 120,         // 8
  borrowed_underlying: 128,     // 8
  user_position_account: 136,   // 32
  current_market: 168,          // 32
  current_position_value: 200,  // 8
  l3_integration: 208,          // 32
  l3_shares_received: 240,      // 8
  current_spent_u8: 248,        // 1
  status_u8: 249,               // 1
  created_at: 250,              // 8 (i64)
  updated_at: 258,              // 8 (i64)
  bump: 266,                    // 1
};

/** Decode a Loan account Buffer into a LoanView */
export function decodeLoanAccount(pda: PublicKey, data: Buffer): LoanView {
  // Basic guard
  if (data.length < LOAN_LAYOUT.size) {
    throw new Error(`Loan account too small: got ${data.length}, expected >= ${LOAN_LAYOUT.size}`);
  }
  // Optional discriminator check
  const disc = data.slice(0, 8);
  if (!disc.equals(DISCRIMINATOR.Loan)) {
    throw new Error(`Invalid Loan discriminator`);
  }

  const borrower = new PublicKey(data.slice(LOAN_LAYOUT.borrower, LOAN_LAYOUT.borrower + 32));
  const loanId = readU64LE(data, LOAN_LAYOUT.loan_id);

  const collateralMarket = new PublicKey(data.slice(LOAN_LAYOUT.collateral_market, LOAN_LAYOUT.collateral_market + 32));
  const collateralAmountRaw = readU64LE(data, LOAN_LAYOUT.collateral_amount);

  const borrowMarket = new PublicKey(data.slice(LOAN_LAYOUT.borrow_market, LOAN_LAYOUT.borrow_market + 32));
  const borrowedAmountRaw = readU64LE(data, LOAN_LAYOUT.borrowed_amount);
  const borrowedUnderlyingRaw = readU64LE(data, LOAN_LAYOUT.borrowed_underlying);

  const userPositionAccount = new PublicKey(data.slice(LOAN_LAYOUT.user_position_account, LOAN_LAYOUT.user_position_account + 32));

  const currentMarket = new PublicKey(data.slice(LOAN_LAYOUT.current_market, LOAN_LAYOUT.current_market + 32));
  const currentPositionValueRaw = readU64LE(data, LOAN_LAYOUT.current_position_value);

  const l3Integration = new PublicKey(data.slice(LOAN_LAYOUT.l3_integration, LOAN_LAYOUT.l3_integration + 32));
  const l3SharesReceivedRaw = readU64LE(data, LOAN_LAYOUT.l3_shares_received);

  const currentSpentU8 = data[LOAN_LAYOUT.current_spent_u8];
  const statusU8 = data[LOAN_LAYOUT.status_u8];

  const createdAt = readI64LE(data, LOAN_LAYOUT.created_at);
  const updatedAt = readI64LE(data, LOAN_LAYOUT.updated_at);

  const bump = data[LOAN_LAYOUT.bump];

  return {
    pda,

    borrower,
    loanId,

    collateralMarket,
    collateralAmountRaw,

    borrowMarket,
    borrowedAmountRaw,
    borrowedUnderlyingRaw,

    userPositionAccount,

    currentMarket,
    currentPositionValueRaw,

    l3Integration,
    l3SharesReceivedRaw,

    currentSpentU8,
    statusU8,

    createdAt,
    updatedAt,

    bump,

    // UI helpers
    collateralAmountUi: toUiNumber(collateralAmountRaw),
    borrowedAmountUi: toUiNumber(borrowedAmountRaw),
    borrowedUnderlyingUi: toUiNumber(borrowedUnderlyingRaw),
    currentPositionValueUi: toUiNumber(currentPositionValueRaw),
    l3SharesReceivedUi: toUiNumber(l3SharesReceivedRaw),
  };
}

/**
 * Fetch a specific loan by deriving its PDA from:
 *  - collateral_market_pda
 *  - borrow_market_pda
 *  - borrower pubkey
 */
export async function fetchLoanByMarkets(args: {
  connection: Connection;
  borrower: PublicKey;
  collateralMarketPda: PublicKey;
  borrowMarketPda: PublicKey;
  commitment?: "processed" | "confirmed" | "finalized";
}): Promise<LoanView | null> {
  const {
    connection,
    borrower,
    collateralMarketPda,
    borrowMarketPda,
    commitment = "confirmed",
  } = args;

  const [loanPda] = deriveLoanPda(collateralMarketPda, borrowMarketPda, borrower);
  const info = await connection.getAccountInfo(loanPda, commitment);

  if (!info || !info.data || info.data.length === 0) return null;
  const data = Buffer.from(info.data);
  return decodeLoanAccount(loanPda, data);
}

/**
 * Fetch all loans for a borrower by scanning program accounts with memcmp.
 * This avoids having to know all market pairs ahead of time.
 */

export async function fetchAllLoansForUser(args: {
  connection: Connection;
  borrower: PublicKey;
  commitment?: "processed" | "confirmed" | "finalized";
}) {
  const { connection, borrower, commitment = "confirmed" } = args;

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    commitment,
    filters: [
      // offset 0: account discriminator (BASE58!)
      { memcmp: { offset: 0, bytes: bs58.encode(LOAN_DISCRIMINATOR) } },
      // offset 8: borrower pubkey (already base58)
      { memcmp: { offset: 8, bytes: borrower.toBase58() } },
    ],
  });

  return accounts.map(({ pubkey, account }) =>
    decodeLoanAccount(pubkey, Buffer.from(account.data))
  );
}


export async function fetchMarketViewRawWeb3(args: {
  marketMint: PublicKey;   // underlying mint of this market (same you pass in NATIVE_MINT)
  connection: Connection;
  commitment?: "processed" | "confirmed" | "finalized";
}) {
  const { marketMint, connection, commitment = "confirmed" } = args;

  // 1. derive the market PDA (that's the actual Market account address)
  const marketPda = deriveMarketPda(marketMint);

  // 2. pull raw account data
  const info = await connection.getAccountInfo(marketPda, commitment);

  if (!info || !info.data || info.data.length === 0) {
    // market might not be initialized on this cluster for that mint
    return {
      pda: marketPda,
      initialized: false,
      totalDepositsUi: 0,
      totalBorrowsUi: 0,
      paused: false,
      raw: null,
    };
  }

  const data = Buffer.from(info.data);

  // decode according to the layout table

  // pubkeys
  const mintPk         = new PublicKey(data.slice(8,   40));
  const supplyVaultPk  = new PublicKey(data.slice(40,  72));
  const sharesMintPk   = new PublicKey(data.slice(72, 104));
  const dtokenMintPk   = new PublicKey(data.slice(104,136));

  // u64s / i64s / u128s
  const totalDeposits          = readU64LE(data, 136); // u64
  const totalDepositedShares   = readU64LE(data, 144); // u64
  const totalBorrowedShares    = readU64LE(data, 152); // u64
  const totalBorrows           = readU64LE(data, 160); // u64
  const totalReserves          = readU64LE(data, 168); // u64
  const lastUpdateTs           = readI64LE(data, 176); // i64
  const supplyIndex            = readU128LE(data, 184); // u128
  const borrowIndex            = readU128LE(data, 200); // u128
  const maxLtv                 = readU64LE(data, 216); // u64
  const liquidationThreshold   = readU64LE(data, 224); // u64
  const liquidationPenalty     = readU64LE(data, 232); // u64
  const reserveFactor          = readU64LE(data, 240); // u64
  const minDepositAmount       = readU64LE(data, 248); // u64
  const maxDepositAmount       = readU64LE(data, 256); // u64
  const minBorrowAmount        = readU64LE(data, 264); // u64
  const maxBorrowAmount        = readU64LE(data, 272); // u64
  const lastWithdrawResetTime  = readI64LE(data, 280); // i64
  const depositSnapshot        = readU64LE(data, 288); // u64
  const depositFee             = readU64LE(data, 296); // u64
  const withdrawFee            = readU64LE(data, 304); // u64
  const borrowFee              = readU64LE(data, 312); // u64
  const repayFee               = readU64LE(data, 320); // u64
  const pausedByte             = data[328];            // bool
  const bumpByte               = data[329];            // u8

  const paused = pausedByte !== 0;

  // For UI we usually want human-ish numbers, so convert some BigInt -> number.
  // NOTE: Downcasting BigInt to Number is only safe if values fit < 2^53-1.
  // For devnet numbers and demos it's fine.
  const bnToNum = (x: bigint) => Number(x.toString());

  return {
    initialized: true,
    pda: marketPda,

    // important headline stats you probably want on the dashboard:
    totalDepositsRaw: totalDeposits,
    totalDepositsUi: bnToNum(totalDeposits),
    totalBorrowsRaw: totalBorrows,
    totalBorrowsUi: bnToNum(totalBorrows),
    totalReservesRaw: totalReserves,
    totalReservesUi: bnToNum(totalReserves),

    supplyIndexRaw: supplyIndex,
    borrowIndexRaw: borrowIndex,

    // rate/config stuff:
    maxLtvRaw: maxLtv,
    liquidationThresholdRaw: liquidationThreshold,
    liquidationPenaltyRaw: liquidationPenalty,
    reserveFactorRaw: reserveFactor,
    depositFeeRaw: depositFee,
    withdrawFeeRaw: withdrawFee,
    borrowFeeRaw: borrowFee,
    repayFeeRaw: repayFee,

    // refs
    mintPk,
    supplyVaultPk,
    sharesMintPk,
    dtokenMintPk,

    // debugging / deeper analytics
    totalDepositedSharesRaw: totalDepositedShares,
    totalBorrowedSharesRaw: totalBorrowedShares,
    minDepositAmountRaw: minDepositAmount,
    maxDepositAmountRaw: maxDepositAmount,
    minBorrowAmountRaw: minBorrowAmount,
    maxBorrowAmountRaw: maxBorrowAmount,
    lastUpdateTs,
    lastWithdrawResetTime,
    depositSnapshotRaw: depositSnapshot,
    paused,
    bump: bumpByte,
  };
}




// 64 zero bytes as a fake sig
const DUMMY_SIG = new Uint8Array(64).fill(0);

export async function simulateForUi(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
) {
  // We are going to mutate a shallow copy of `tx` so we don't dirty the real one.
  // Easiest safe path: manually clone by copying fields, NOT by serialize/deserialize.
  const txForSim = new Transaction();
  txForSim.recentBlockhash = tx.recentBlockhash;
  txForSim.feePayer = tx.feePayer;
  txForSim.lastValidBlockHeight = (tx as any).lastValidBlockHeight;
  // copy all instructions
  tx.instructions.forEach(ix => {
    txForSim.add(ix);
  });

  // Now we have to satisfy "all required signer sigs exist".
  // For legacy Transaction, signatures is an array aligned with `tx.serializeMessage()`.
  // We'll build a signatures array with 1 fake sig for feePayer.

  // Copy over the requiredSignatures meta from original:
  // Note: web3.js sets tx.signatures = [{publicKey, signature}, ...]
  // We'll mirror that, but with dummy bytes.

  txForSim.signatures = [
    {
      publicKey: feePayer,
      signature: Buffer.from(DUMMY_SIG),
    },
  ];

  // Now call simulateTransaction using legacy overload:
  //   simulateTransaction(tx: Transaction, signers?: Signer[])
  //
  // We ALREADY populated `txForSim.signatures`, so we don't need to
  // provide actual signers in the 2nd arg.
  const simRes = await connection.simulateTransaction(txForSim);

  return simRes;
}



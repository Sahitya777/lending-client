import { PublicKey } from "@solana/web3.js";


export const CORE_ROUTER_PROGRAM_ID = new PublicKey(
"4i28wYuQQVnbAMZekQryDTb4nAmEcDwBVRH5kZPjgRiA"
);


export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);


export type MarketConfig = {
maxLtv: import("@coral-xyz/anchor").BN;
liquidationThreshold: import("@coral-xyz/anchor").BN;
liquidationPenalty: import("@coral-xyz/anchor").BN;
reserveFactor: import("@coral-xyz/anchor").BN;
minDepositAmount: import("@coral-xyz/anchor").BN;
maxDepositAmount: import("@coral-xyz/anchor").BN;
minBorrowAmount: import("@coral-xyz/anchor").BN;
maxBorrowAmount: import("@coral-xyz/anchor").BN;
depositFee: import("@coral-xyz/anchor").BN;
withdrawFee: import("@coral-xyz/anchor").BN;
borrowFee: import("@coral-xyz/anchor").BN;
repayFee: import("@coral-xyz/anchor").BN;
};


export const IDL_MIN = {
address: CORE_ROUTER_PROGRAM_ID.toBase58(),
metadata: { name: "core_router", version: "0.1.0", spec: "0.1.0" },
instructions: [
{ name: "deposit" },
{ name: "withdraw" },
{ name: "initializeProtocol" },
{ name: "initializeMarket" },
{ name: "initializeUserPosition" },
],
} as const;
import { PublicKey } from "@solana/web3.js";
import { CORE_ROUTER_PROGRAM_ID } from "../types/types";

const TE = new TextEncoder();

export function findProtocolStatePda(): [PublicKey, number] {
return PublicKey.findProgramAddressSync(
[TE.encode("protocol_state")],
CORE_ROUTER_PROGRAM_ID
);
}


/** market PDA = ["market", underlying_mint] */
export function findMarketPda(underlyingMint: PublicKey): [PublicKey, number] {
return PublicKey.findProgramAddressSync(
[TE.encode("market"), underlyingMint.toBuffer()],
CORE_ROUTER_PROGRAM_ID
);
}


/** supply_vault PDA = ["supply_vault", market] */
export function findSupplyVaultPda(market: PublicKey): [PublicKey, number] {
return PublicKey.findProgramAddressSync(
[TE.encode("supply_vault"), market.toBuffer()],
CORE_ROUTER_PROGRAM_ID
);
}


/** user_position PDA = ["user_account", signer, market_mint] */
export function findUserPositionPda(
user: PublicKey,
marketMint: PublicKey
): [PublicKey, number] {
return PublicKey.findProgramAddressSync(
[TE.encode("user_account"), user.toBuffer(), marketMint.toBuffer()],
CORE_ROUTER_PROGRAM_ID
);
}
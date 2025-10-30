// src/app/api/mint/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";


const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function loadKeypairFromEnv(): Keypair {
  // Supported envs (in priority order)
  const json = process.env.NEXT_PRIVATE_KEEPER_KEY || process.env.PRIVATE_KEY_JSON;
  const b58 = process.env.PRIVATE_KEY_BASE58;
  const b64 = process.env.PRIVATE_KEY_BASE64;

  let secret: Uint8Array | null = null;

  if (json) {
    try {
      const arr = JSON.parse(json) as number[];
      if (!Array.isArray(arr) || arr.some((n) => typeof n !== "number")) {
        throw new Error("JSON must be an array of numbers");
      }
      secret = new Uint8Array(arr);
    } catch (e: any) {
      throw new Error(`Failed to parse NEXT_PRIVATE_KEEPER_KEY/PRIVATE_KEY_JSON: ${e?.message || String(e)}`);
    }
  } else if (b58) {
    try {
      secret = new Uint8Array(bs58.decode(b58.trim()));
    } catch {
      throw new Error("Failed to decode PRIVATE_KEY_BASE58. Must be valid base58.");
    }
  } else if (b64) {
    try {
      secret = new Uint8Array(Buffer.from(b64.trim(), "base64"));
    } catch {
      throw new Error("Failed to decode PRIVATE_KEY_BASE64. Must be valid base64.");
    }
  } else {
    throw new Error("Missing private key env. Set NEXT_PRIVATE_KEEPER_KEY (JSON array) or PRIVATE_KEY_JSON/BASE58/BASE64.");
  }

  if (secret.byteLength !== 64 && secret.byteLength !== 32) {
    throw new Error(`Secret must decode to 64 or 32 bytes; got ${secret.byteLength}.`);
  }
  return Keypair.fromSecretKey(secret);
}

type MintRequest = { mintAddress?: string; amount?: number | string; recipient?: string };

const base58Addr = /^[1-9A-HJ-NP-Za-km-z]+$/;

export async function POST(req: Request) {
  try {
    const { mintAddress, amount, recipient } = (await req.json()) as MintRequest;
    if (!mintAddress || amount === undefined || !recipient) {
      return NextResponse.json({ error: "mintAddress, amount, recipient required" }, { status: 400 });
    }
    if (!base58Addr.test(mintAddress)) return NextResponse.json({ error: "mintAddress is not valid base58" }, { status: 400 });
    if (!base58Addr.test(recipient)) return NextResponse.json({ error: "recipient is not valid base58" }, { status: 400 });

    const payer = loadKeypairFromEnv();
    const connection = new Connection(RPC, "confirmed");

    const mintPubkey = new PublicKey(mintAddress);
    const recipientPubkey = new PublicKey(recipient);

    const mintInfo = await getMint(connection, mintPubkey);
    if (!mintInfo.mintAuthority) {
      return NextResponse.json({ error: "Mint has no mintAuthority (non-mintable/frozen)" }, { status: 400 });
    }
    if (!mintInfo.mintAuthority.equals(payer.publicKey)) {
      return NextResponse.json(
        {
          error: "This server key is not the mint authority for that mintAddress",
          expectedMintAuthority: mintInfo.mintAuthority.toBase58(),
          yourKey: payer.publicKey.toBase58(),
        },
        { status: 403 }
      );
    }

    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mintPubkey, recipientPubkey);

    const decimals = mintInfo.decimals;
    const floatAmount = Number(amount);
    if (!Number.isFinite(floatAmount) || floatAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    const rawAmount = BigInt(Math.round(floatAmount * Math.pow(10, decimals)));

    const signature = await mintTo(connection, payer, mintPubkey, ata.address, payer, rawAmount);

    return NextResponse.json({ signature, recipientAta: ata.address.toBase58(), decimals });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

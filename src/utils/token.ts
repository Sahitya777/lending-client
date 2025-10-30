// src/utils/tokens.ts
export type TokenSymbol = "SOL" | "USDC" | "USDT";

export type TokenMeta = {
  symbol: TokenSymbol;
  mint: string;       // base58
  decimals: number;
};

// Add/adjust to match your app's “markets” config
export const TOKENS: Record<TokenSymbol, TokenMeta> = {
  SOL:  {
    symbol: "SOL",
    mint: "6SHAjCy7dMASzXuB2RfLdu59yJvz1BfAoQFrcrom3QV8",
    decimals: 9,
  },
  USDC: {
    symbol: "USDC",
    mint: "54ZpVAgA688A6U7mDQM3k5xiUcxaKvDMcTEaAp447tjo", // mainnet
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    mint: "AKss9fzPfmV48SmC6TxFXa4XWo1Ck6sjcF3DkWH6QXJf", // mainnet
    decimals: 6,
  },
};

// Optional: quick lookup by mint for anywhere you only have a mint
const BY_MINT = Object.values(TOKENS).reduce<Record<string, TokenMeta>>(
  (acc, t) => {
    acc[t.mint] = t;
    return acc;
  },
  {}
);

// Get decimals by symbol (case-insensitive)
export function getDecimalsBySymbol(symbol: string, fallback = 9): number {
  const key = symbol.toUpperCase() as TokenSymbol;
  return TOKENS[key]?.decimals ?? fallback;
}

// Get decimals by mint
export function getDecimalsByMint(mint: string, fallback = 9): number {
  return BY_MINT[mint]?.decimals ?? fallback;
}

// Full meta (symbol OR mint). Useful if you sometimes pass a mint instead.
export function getTokenMeta(id: string): TokenMeta | undefined {
  const bySym = TOKENS[id.toUpperCase() as TokenSymbol];
  if (bySym) return bySym;
  return BY_MINT[id];
}

export function getMintBySymbol(symbol: string, fallback?: string) {
  const key = symbol.toUpperCase() as TokenSymbol;
  const mint = TOKENS[key]?.mint;
  return mint ?? fallback;
}

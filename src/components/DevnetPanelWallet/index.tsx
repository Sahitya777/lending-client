"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import Image from "next/image";
import { getTokenIcon } from "@/utils/helper";
import { PythPrice } from "@/hooks/usePrice";

/**
 * TokenConfig
 * ------------------------------------------------------------
 * Describes each asset we want to show in the wallet:
 *  - SOL (native)
 *  - USDC devnet mint
 *  - USDT devnet mint
 */
export type TokenConfig = {
  symbol: string;
  // Use `native: true` for SOL. For SPL tokens provide mint.
  native?: boolean;
  mint?: string;
  // Fallback/static USD (only used if no live oracle price is available)
  usdPrice?: number;
  // Mark if it's Token-2022 program, just in case
  programId?: "token-2022" | "token";
};

// Default assets we want to show in the wallet panel
const DEFAULT_TOKENS: TokenConfig[] = [
  {
    symbol: "SOL",
    native: true,
    usdPrice: 0.0,
  },
  {
    symbol: "USDC",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    usdPrice: 1.0,
    programId: "token",
  },
  {
    symbol: "USDT",
    mint: "Ejmc1UB4EsES5UfZyaG7kRGtCLGnogT7xWRqvEih5Z7",
    usdPrice: 1.0,
    programId: "token",
  },
];

/**
 * DevnetWalletPanel
 * ------------------------------------------------------------
 * Props:
 *  - solValue, usdtValue, usdcValue:
 *      live oracle quotes from Pyth, e.g. { price: 195.77, ... }
 *      IMPORTANT: we assume .price is already scaled to human USD.
 *
 *  - rpcUrl:
 *      which Solana cluster to query (defaults to devnet)
 *
 *  - tokenConfigs:
 *      which tokens/mints to display
 *
 *  - title:
 *      card header label
 */
export default function DevnetWalletPanel({
  solValue,
  usdtValue,
  usdcValue,
  rpcUrl = clusterApiUrl("devnet"),
  tokenConfigs = DEFAULT_TOKENS,
  title = "Wallet",
}: {
  solValue: PythPrice;
  usdtValue: PythPrice;
  usdcValue: PythPrice;
  rpcUrl?: string;
  tokenConfigs?: TokenConfig[];
  title?: string;
}) {
  const { primaryWallet } = useDynamicContext();
  const address = primaryWallet?.address;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // rows = balances for each token
  const [rows, setRows] = useState<
    { symbol: string; amount: number }[]
  >([]);

  const [showYeilds, setshowYeilds] = useState<boolean>(true);

  // Memoize Solana RPC connection so we don't rebuild it every render
  const connection = useMemo(
    () => new Connection(rpcUrl, "confirmed"),
    [rpcUrl]
  );

  /**
   * livePricesBySymbol
   * ------------------------------------------------------------
   * Map token symbol -> live USD price from oracle.
   *
   * We assume:
   *  - solValue.price   is SOL/USD
   *  - usdtValue.price  is USDT/USD
   *  - usdcValue.price  is USDC/USD
   *
   * If in your hook it's called `priceNum` instead of `price`,
   * just swap those here.
   */
  const livePricesBySymbol: Record<string, number | undefined> = {
    SOL: solValue?.price ?? undefined,
    USDT: usdtValue?.price ?? undefined,
    USDC: usdcValue?.price ?? undefined,
  };

  /**
   * Fetch balances whenever wallet, connection, or token list changes.
   */
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!address) return;
      setLoading(true);
      setError(null);

      try {
        const owner = new PublicKey(address);

        // We'll build up newRows like [{symbol:"SOL", amount: x}, ...]
        const newRows: { symbol: string; amount: number }[] = [];

        // 1) Native SOL balance
        const solCfg = tokenConfigs.find((t) => t.native);
        if (solCfg) {
          const lamports = await connection.getBalance(owner);
          newRows.push({
            symbol: solCfg.symbol,
            amount: lamports / LAMPORTS_PER_SOL,
          });
        }

        // 2) SPL tokens: look up token accounts owned by wallet
        // We'll query both the classic token program and Token-2022 program.
        // NOTE: We're not filtering here by each mint individually first;
        // we fetch everything then match.
        const allParsed = await connection.getParsedTokenAccountsByOwner(
          owner,
          {
            programId: TOKEN_PROGRAM_ID,
          }
        );

        const allParsed2022 = await connection
          .getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_2022_PROGRAM_ID,
          })
          .catch(() => ({ value: [] as any[] })); // if call fails, just treat as empty

        const allTokenAccounts = [
          ...allParsed.value,
          ...allParsed2022.value,
        ];

        // For each non-native token config, find the matching ATA balance
        for (const cfg of tokenConfigs.filter((t) => !t.native && t.mint)) {
          const mintStr = cfg.mint!;
          const match = allTokenAccounts.find(
            (a) => a.account.data?.parsed?.info?.mint === mintStr
          );

          let amount = 0;
          if (match) {
            const uiAmt =
              match.account.data?.parsed?.info?.tokenAmount?.uiAmount;
            amount = typeof uiAmt === "number" ? uiAmt : 0;
          }

          newRows.push({
            symbol: cfg.symbol,
            amount,
          });
        }

        if (!cancelled) {
          setRows(newRows);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to fetch balances");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [address, connection, tokenConfigs]);

  /**
   * totalUSD
   * ------------------------------------------------------------
   * Sum over all rows: amount * livePrice(symbol).
   * If a price isn't available yet, treat it as 0 for total.
   */
  const totalUSD = useMemo(() => {
    return rows.reduce((acc, row) => {
      const livePx = livePricesBySymbol[row.symbol];
      if (livePx === undefined || livePx === null) return acc;
      return acc + row.amount * livePx;
    }, 0);
  }, [rows, livePricesBySymbol]);

  return (
    <div className="space-y-4 w-full">
      {/* WALLET CARD */}
      <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-sm font-bold text-white">
            {address
              ? `$${totalUSD.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "$0.00"}
          </div>
        </div>

        {!address && (
          <div className="px-5 py-6 text-sm text-gray-600">
            Connect your wallet to view devnet balances.
          </div>
        )}

        {address && (
          <div className="px-5 pb-5">
            {/* header row */}
            <div className="grid grid-cols-4 text-xs font-medium text-gray-500 px-1 pt-4 pb-2">
              <div>Assets</div>
              <div className="text-right">Price</div>
              <div className="text-right">Tokens</div>
              <div className="text-right">Amount</div>
            </div>

            {loading && (
              <div className="px-1 py-3 text-sm text-gray-500">
                Loading balances…
              </div>
            )}

            {error && (
              <div className="px-1 py-3 text-sm text-red-600">{error}</div>
            )}

            {/* rows */}
            <div className="divide-y">
              {rows.map((r) => {
                const livePx = livePricesBySymbol[r.symbol];
                const rowUsdValue =
                  livePx !== undefined && livePx !== null
                    ? r.amount * livePx
                    : undefined;

                return (
                  <div
                    key={r.symbol}
                    className="grid grid-cols-4 items-center px-1 py-3 text-sm"
                  >
                    {/* Asset symbol + icon */}
                    <div className="flex items-center gap-3">
                      {getTokenIcon(r.symbol) && (
                        <Image
                          src={getTokenIcon(r.symbol) as any}
                          alt="logo"
                          height={18}
                          width={18}
                        />
                      )}
                      <span className="font-medium text-white">
                        {r.symbol}
                      </span>
                    </div>

                    {/* USD price per token */}
                    <div className="text-right">
                      {livePx !== undefined && livePx !== null
                        ? `$${livePx.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </div>

                    {/* Token balance */}
                    <div className="text-right">
                      {r.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </div>

                    {/* Total USD value for that row */}
                    <div className="text-right">
                      {rowUsdValue !== undefined
                        ? `$${rowUsdValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* YIELD OPPORTUNITIES CARD */}
      <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Yield opportunities</h2>
          <button
            className="rounded-lg p-1 hover:bg-gray-100 transition cursor-pointer"
            aria-label="collapse"
            onClick={() => setshowYeilds(!showYeilds)}
          >
            {!showYeilds ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>

        {showYeilds && (
          <div className="p-2">
            {[
              { label: "SOL", apy: 149.28 },
              { label: "USDT", apy: 128.94 },
              { label: "USDC", apy: 128.61 },
            ].map((op) => (
              <div
                key={op.label}
                className="flex items-center justify-between px-3 py-3 text-sm hover:bg-[#1F1F1F] rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {getTokenIcon(op.label) && (
                    <Image
                      src={getTokenIcon(op.label) as any}
                      alt="logo"
                      height={18}
                      width={18}
                    />
                  )}
                  <span className="font-medium">LEND {op.label}</span>
                </div>
                <div className="text-right font-medium">
                  {op.apy.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * OPTIONAL: Standalone hook (kept here for convenience)
 * ------------------------------------------------------------
 * If you want to consume balances without the panel UI, you can
 * use this hook directly somewhere else.
 *
 * Returns: { loading, error?, rows: [{symbol, amount, usdPrice?}] }
 * The `usdPrice?` field here is only from tokenConfigs fallback,
 * not the live oracle.
 */
export function useDevnetBalances(args: {
  address?: string;
  rpcUrl?: string;
  tokenConfigs?: TokenConfig[];
}) {
  const {
    address,
    rpcUrl = clusterApiUrl("devnet"),
    tokenConfigs = DEFAULT_TOKENS,
  } = args;

  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    rows: { symbol: string; amount: number; usdPrice?: number }[];
  }>({ loading: false, rows: [] });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!address) return;

      setState({ loading: true, rows: [] });

      try {
        const connection = new Connection(rpcUrl, "confirmed");
        const owner = new PublicKey(address);

        const results: {
          symbol: string;
          amount: number;
          usdPrice?: number;
        }[] = [];

        // Native SOL
        const solCfg = tokenConfigs.find((t) => t.native);
        if (solCfg) {
          const lamports = await connection.getBalance(owner);
          results.push({
            symbol: solCfg.symbol,
            amount: lamports / LAMPORTS_PER_SOL,
            usdPrice: solCfg.usdPrice,
          });
        }

        // Token program + Token-2022
        const allParsed = await connection.getParsedTokenAccountsByOwner(
          owner,
          { programId: TOKEN_PROGRAM_ID }
        );
        const allParsed2022 = await connection
          .getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_2022_PROGRAM_ID,
          })
          .catch(() => ({ value: [] as any[] }));

        const all = [...allParsed.value, ...allParsed2022.value];

        // SPL tokens
        for (const cfg of tokenConfigs.filter((t) => !t.native && t.mint)) {
          const match = all.find(
            (a) => a.account.data?.parsed?.info?.mint === cfg.mint
          );
          const ui =
            match?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
          results.push({
            symbol: cfg.symbol,
            amount: typeof ui === "number" ? ui : 0,
            usdPrice: cfg.usdPrice,
          });
        }

        if (!cancelled) {
          setState({ loading: false, rows: results });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState({
            loading: false,
            rows: [],
            error: e?.message || "Failed to load balances",
          });
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [address, rpcUrl, JSON.stringify(tokenConfigs)]);

  return state;
}

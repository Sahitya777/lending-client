"use client";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import Image from "next/image";
import { getTokenIcon } from "@/utils/helper";
/**
 * DevnetWalletPanel
 * ------------------------------------------------------------
 * A self‑contained right‑hand column that fetches balances for:
 *   - Native SOL
 *   - A short list of SPL tokens (e.g. USDC Devnet)
 *
 * It uses Dynamic Labs to read the connected wallet address.
 * The UI mirrors the "Wallet" + "Yield opportunities" pane in your screenshot.
 *
 * How to use (Next.js / App Router):
 *   1) Ensure deps are installed:
 *        npm i @solana/web3.js @solana/spl-token lucide-react @dynamic-labs/sdk-react-core
 *   2) Drop this file into your project and render <DevnetWalletPanel />
 *   3) Optionally pass `rpcUrl` and `tokenConfigs` to customize.
 */

export type TokenConfig = {
  symbol: string;
  // Use `native: true` for SOL. For SPL tokens provide mint.
  native?: boolean;
  mint?: string;
  // For the UI value column (devnet has no market prices). You can pipe in mocked prices
  // from props, or leave undefined to show "—".
  usdPrice?: number;
  // Some devnet tokens use Token-2022; default uses classic token program.
  programId?: "token-2022" | "token";
};

const DEFAULT_TOKENS: TokenConfig[] = [
  { symbol: "SOL", native: true, usdPrice: 0.0 },
  // Canonical USDC Devnet mint
  {
    symbol: "USDC",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    usdPrice: 1.0,
    programId: "token",
  },
  // Example extra (comment in if you want USDT Devnet)
  {
    symbol: "USDT",
    mint: "Ejmc1UB4EsES5UfZyaG7kRGtCLGnogT7xWRqvEih5Z7",
    usdPrice: 1.0,
    programId: "token",
  },
];

export default function DevnetWalletPanel({
  rpcUrl = clusterApiUrl("devnet"),
  tokenConfigs = DEFAULT_TOKENS,
  title = "Wallet",
}: {
  rpcUrl?: string;
  tokenConfigs?: TokenConfig[];
  title?: string;
}) {
  const { user, primaryWallet } = useDynamicContext();
  const address = primaryWallet?.address;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    { symbol: string; amount: number; usdPrice?: number }[]
  >([]);
  const [showYeilds, setshowYeilds] = useState<boolean>(true);

  const connection = useMemo(
    () => new Connection(rpcUrl, "confirmed"),
    [rpcUrl]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const owner = new PublicKey(address);

        // 1) Native SOL
        const solCfg = tokenConfigs.find((t) => t.native);
        const results: { symbol: string; amount: number; usdPrice?: number }[] =
          [];
        if (solCfg) {
          const lamports = await connection.getBalance(owner);
          results.push({
            symbol: solCfg.symbol,
            amount: lamports / LAMPORTS_PER_SOL,
            usdPrice: solCfg.usdPrice,
          });
        }

        // 2) SPL tokens — fetch balances by mint
        const nonNative = tokenConfigs.filter((t) => !t.native && t.mint);
        if (nonNative.length) {
          // Query token accounts once, then map by mint
          const allParsed = await connection.getParsedTokenAccountsByOwner(
            owner,
            {
              programId: TOKEN_PROGRAM_ID,
            }
          );
          // Optional: also check Token-2022 program in case some devnet mints are 2022
          const allParsed2022 = await connection
            .getParsedTokenAccountsByOwner(owner, {
              programId: TOKEN_2022_PROGRAM_ID,
            })
            .catch(() => ({ value: [] as any[] }));

          const all = [...allParsed.value, ...allParsed2022.value];

          for (const cfg of nonNative) {
            const mintStr = cfg.mint!;
            const match = all.find(
              (a) => a.account.data?.parsed?.info?.mint === mintStr
            );
            let amount = 0;
            if (match) {
              const ui = match.account.data.parsed.info.tokenAmount.uiAmount;
              amount = typeof ui === "number" ? ui : 0;
            }
            results.push({
              symbol: cfg.symbol,
              amount,
              usdPrice: cfg.usdPrice,
            });
          }
        }

        if (!cancelled) setRows(results);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to fetch balances");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address, connection, tokenConfigs]);

  const totalUSD = useMemo(() => {
    return rows.reduce(
      (acc, r) => acc + (r.usdPrice ? r.amount * r.usdPrice : 0),
      0
    );
  }, [rows]);

  return (
    <div className="space-y-4 w-full">
      {/* Wallet card */}
      <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-sm font-bold text-white">
            {address ? `$${totalUSD.toFixed(2)}` : "$0.00"}
          </div>
        </div>

        {!address && (
          <div className="px-5 py-6 text-sm text-gray-600">
            Connect your wallet to view devnet balances.
          </div>
        )}

        {address && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-4 text-xs font-medium text-gray-500 px-1 pt-4 pb-2">
              <div>Assets</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Value</div>
              <div className="text-right"></div>
            </div>

            {loading && (
              <div className="px-1 py-3 text-sm text-gray-500">
                Loading balances…
              </div>
            )}
            {error && (
              <div className="px-1 py-3 text-sm text-red-600">{error}</div>
            )}

            <div className="divide-y">
              {rows.map((r) => {
                const value = r.usdPrice ? r.amount * r.usdPrice : undefined;
                return (
                  <div
                    key={r.symbol}
                    className="grid grid-cols-4 items-center px-1 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {getTokenIcon(r.symbol as string) && (
                        <Image
                          src={getTokenIcon(r.symbol as string) as any}
                          alt="logo"
                          height={18}
                          width={18}
                        />
                      )}
                      <span className="font-medium text-white">{r.symbol}</span>
                    </div>
                    <div className="text-right">
                      {r.usdPrice != null ? `$${r.usdPrice.toFixed(2)}` : "—"}
                    </div>
                    <div className="text-right">
                      {r.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </div>
                    <div className="text-right">
                      {value != null ? `$${value.toFixed(2)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Yield opportunities placeholder (static for now) */}
      <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Yield opportunities</h2>

          <button
            className="rounded-lg p-1 hover:bg-gray-100 transition cursor-pointer"
            aria-label="collapse"
            onClick={() => {
              setshowYeilds(!showYeilds);
            }}
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
                className="flex items-center justify-between px-3 py-3 text-sm hover:bg-emerald-900/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {getTokenIcon(op.label as string) && (
                    <Image
                      src={getTokenIcon(op.label as string) as any}
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
 * Optional helper if you want a single hook elsewhere
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
        const results: { symbol: string; amount: number; usdPrice?: number }[] =
          [];
        const solCfg = tokenConfigs.find((t) => t.native);
        if (solCfg) {
          const lamports = await connection.getBalance(owner);
          results.push({
            symbol: solCfg.symbol,
            amount: lamports / LAMPORTS_PER_SOL,
            usdPrice: solCfg.usdPrice,
          });
        }
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
        for (const cfg of tokenConfigs.filter((t) => !t.native && t.mint)) {
          const match = all.find(
            (a) => a.account.data?.parsed?.info?.mint === cfg.mint
          );
          const ui = match?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
          results.push({
            symbol: cfg.symbol,
            amount: typeof ui === "number" ? ui : 0,
            usdPrice: cfg.usdPrice,
          });
        }
        if (!cancelled) setState({ loading: false, rows: results });
      } catch (e: any) {
        if (!cancelled)
          setState({
            loading: false,
            rows: [],
            error: e?.message || "Failed to load balances",
          });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address, rpcUrl, JSON.stringify(tokenConfigs)]);
  return state;
}

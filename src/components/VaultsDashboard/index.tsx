"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ActionPanel } from "../HomescreenDashboard/components/ActionPanel";

import btcicon from "../../assets/cryptoIcons/bitcoin-btc-logo.png";
import ethicon from "../../assets/cryptoIcons/ethereum-eth-logo.png";
import solicon from "../../assets/cryptoIcons/solana-sol-logo.png";
import usdcicon from "../../assets/cryptoIcons/usd-coin-usdc-logo.png";
import usdticon from "../../assets/cryptoIcons/tether-usdt-logo.png";
import suiicon from "../../assets/cryptoIcons/sui-sui-logo.png";

import { Button } from "../ui/button";

import {
  SOL_FEED_ID,
  USDC_FEED_ID,
  USDT_FEED_ID,
} from "@/constants/pricefeedids";

import { usePythPrice } from "@/hooks/usePrice";

import { PublicKey } from "@solana/web3.js";
import { getConnection } from "@/utils/chain/solana";
import { fetchMarketViewRawWeb3 } from "@/utils/chain/helper";

// Static base market metadata. These are "templates" that we enrich.
const markets = [
  {
    organization: "Solend",
    name: "SOL",
    symbol: "Solana",
    price: "$230.45",
    apy: "+7.76%",
    apr: "3.83%",
    totalSupply: "$4.01M",
    totalBorrow: "$2.69M",
    tier: "Shared",
    rewards: true,
    icon: solicon,
    mintAddress: "84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk",
  },
  {
    organization: "Jupiter",
    name: "USDC",
    symbol: "USD Coin",
    price: "$0.9991",
    apy: "+7.76%",
    apr: "3.83%",
    totalSupply: "$4.01M",
    totalBorrow: "$2.69M",
    tier: "Shared",
    rewards: true,
    icon: usdcicon,
    mintAddress: "84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk",
  },
  {
    organization: "Kamino",
    name: "USDT",
    symbol: "Tether USD",
    price: "$0.9995",
    apy: "+8.18%",
    apr: "3.84%",
    totalSupply: "$1.52M",
    totalBorrow: "$1.02M",
    tier: "Shared",
    rewards: true,
    icon: usdticon,
    mintAddress: "84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk",
  },
];

export default function VaultDashboard() {
  // tab state for filtering
  const [currentSelectedTab, setCurrentSelectedTab] = useState<
    "All" | "Shared" | "Isolated" | "Cross"
  >("All");

  // side panel state
  const [actionPanel, setActionPanel] = useState<null | {
    type:
      | "supply"
      | "withdraw"
      | "repay"
      | "spend"
      | "addCollateral"
      | "borrow";
    asset: string;
    mintAddress: string;
  }>(null);

  // live oracle quotes
  const sol = usePythPrice(SOL_FEED_ID);
  const usdc = usePythPrice(USDC_FEED_ID);
  const usdt = usePythPrice(USDT_FEED_ID);

  // memoize price map so the object identity is stable between renders
  const livePricesBySymbol = useMemo<
    Record<string, number | undefined>
  >(
    () => ({
      SOL: sol?.price ?? undefined,
      USDT: usdt?.price ?? undefined,
      USDC: usdc?.price ?? undefined,
    }),
    [sol?.price, usdt?.price, usdc?.price]
  );

  // on-chain market state
  const [marketRows, setMarketRows] = useState<any[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState<boolean>(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // build enriched rows (APRs, TVL, etc). Memoized with useCallback so we
  // can safely include it in useEffect deps without re-triggering constantly.
  const buildEnrichedMarketsForUser = useCallback(async () => {
    // you can wire wallet -> PublicKey here later if needed
    // right now we don't actually use the wallet, so we skip ownerPk logic

    const connection = getConnection();
    const enriched: any[] = [];

    for (const m of markets) {
      try {
        const mintPk = new PublicKey(m.mintAddress);

        const mv = await fetchMarketViewRawWeb3({
          marketMint: mintPk,
          connection,
          commitment: "confirmed",
        });

        const totalDeposits = Number(mv.totalDepositsUi);
        const totalBorrows = Number(mv.totalBorrowsUi);
        const reserveFactor = Number(mv.reserveFactorRaw) / 10000; // assume bps
        const maxLtv = Number(mv.maxLtvRaw) / 100;
        const utilization =
          totalDeposits > 0 ? totalBorrows / totalDeposits : 0; // 0..1

        // toy interest rate model
        const baseRate = 0.02;
        const slope1 = 0.2;
        const borrowApr = baseRate + slope1 * utilization;
        const supplyApr = borrowApr * utilization * (1 - reserveFactor);

        enriched.push({
          ...m,
          supplyAprPct: (supplyApr * 100).toFixed(2), // string like "5.12"
          borrowAprPct: (borrowApr * 100).toFixed(2),
          totalSupplyUi: totalDeposits,
          totalBorrowUi: totalBorrows,
          utilizationPct: utilization * 100,
          maxLtv: maxLtv.toFixed(0),
        });
      } catch (err) {
        // fallback if something fails
        enriched.push({
          ...m,
          supplyAprPct: "0.00",
          borrowAprPct: "0.00",
          totalSupplyUi: 0,
          totalBorrowUi: 0,
          utilizationPct: 0,
          maxLtv: "0",
        });
      }
    }

    return enriched;
  }, []);

  // fetch on mount
  useEffect(() => {
    (async () => {
      try {
        setIsRowsLoading(true);
        setRowsError(null);
        const rows = await buildEnrichedMarketsForUser();
        setMarketRows(rows);
      } catch (e: any) {
        setRowsError(e?.message || "Failed to load vaults");
        setMarketRows([]);
      } finally {
        setIsRowsLoading(false);
      }
    })();
  }, [buildEnrichedMarketsForUser]);

  // Filter the enriched `marketRows` rather than the static `markets`
  const filteredMarkets = useMemo(() => {
    if (currentSelectedTab === "All") return marketRows;
    return marketRows.filter((m) => m.tier === currentSelectedTab);
  }, [currentSelectedTab, marketRows]);

  const router = useRouter();

  // Treat Pyth as "loading" until we have at least some non-undefined prices
  const oracleLoading =
    livePricesBySymbol.SOL === undefined ||
    livePricesBySymbol.USDC === undefined ||
    livePricesBySymbol.USDT === undefined;

  // Global loading state for table
  const isLoading = isRowsLoading || oracleLoading;

  return (
    <div className="min-h-screen bg-[#181818] w-[96%] ml-[2%] rounded-md text-white">
      <main className="mx-auto max-w-7xl rounded-md">
        <div className="flex w-full gap-6">
          {/* LEFT SIDE: table */}
          <div
            className={
              actionPanel
                ? "w-[65%] flex flex-col gap-4"
                : "w-full flex flex-col gap-4"
            }
          >
            <div className="rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#2a2a2a] text-left">
                    <tr>
                      <th className="py-5 px-6 text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Organisations
                      </th>
                      <th className="py-5 px-6 text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Assets
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Deposit
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Borrow
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        LTV
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Deposit APR
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* LOADING ROW */}
                    {isLoading && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-10 px-6 text-center text-gray-400 text-sm"
                        >
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            <div>Loading vault data…</div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ERROR ROW */}
                    {!isLoading && rowsError && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-10 px-6 text-center text-red-500 text-sm"
                        >
                          {rowsError}
                        </td>
                      </tr>
                    )}

                    {/* DATA ROWS */}
                    {!isLoading &&
                      !rowsError &&
                      filteredMarkets.map((m, i) => {
                        const livePx = livePricesBySymbol[m.name];
                        const displayPx =
                          livePx !== undefined
                            ? `$${livePx.toFixed(2)}`
                            : "—";

                        return (
                          <tr
                            key={`${m.name}-${i}`}
                            className="border-b border-[#2a2a2a] hover:bg-[#222222]/40 transition-colors cursor-pointer"
                            onClick={() => {
                              setActionPanel({
                                type: "supply",
                                asset: String(m.name),
                                mintAddress: m.mintAddress ?? "",
                              });
                            }}
                          >
                            {/* Organisation */}
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 relative flex-shrink-0">
                                  <Image
                                    src={m.icon}
                                    alt={m.organization}
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-white text-sm leading-tight">
                                    {m.organization}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Asset */}
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 relative flex-shrink-0">
                                  <Image
                                    src={m.icon}
                                    alt={m.name}
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-white text-sm leading-tight">
                                    {m.name}
                                  </span>
                                  <span className="text-[11px] text-gray-400 leading-tight">
                                    {displayPx}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Deposit (your mock "apy") */}
                            <td className="py-5 px-6 text-right text-[#FECD6D] font-semibold text-sm">
                              {m.apy ?? "--"}
                            </td>

                            {/* Borrow (your mock "apr") */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {m.apr ?? "--"}
                            </td>

                            {/* LTV (you were using totalSupply in the mock) */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {m.totalSupply ?? "--"}
                            </td>

                            {/* Deposit APR (you were using totalBorrow in the mock) */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {m.totalBorrow ?? "--"}
                            </td>

                            {/* Supply button */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              <Button
                                className="bg-[#FECD6D] hover:bg-[#fece6dd5] text-black cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                onClick={(e) => {
                                  e.stopPropagation(); // don't trigger row onClick
                                  setActionPanel({
                                    type: "supply",
                                    asset: String(m.name),
                                    mintAddress: m.mintAddress ?? "",
                                  });
                                }}
                              >
                                Supply
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                    {/* EMPTY STATE */}
                    {!isLoading &&
                      !rowsError &&
                      filteredMarkets.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 px-6 text-center text-gray-500 text-sm"
                          >
                            No markets found for {currentSelectedTab}.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: action panel dock */}
          {actionPanel && (
            <div className="w-[35%] space-y-6">
              <ActionPanel
                actionPanel={actionPanel}
                onClose={() => setActionPanel(null)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

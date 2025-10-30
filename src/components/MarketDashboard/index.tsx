"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ActionPanel } from "../HomescreenDashboard/components/ActionPanel";
import solicon from "../../assets/cryptoIcons/solana-sol-logo.png";
import usdcicon from "../../assets/cryptoIcons/usd-coin-usdc-logo.png";
import usdticon from "../../assets/cryptoIcons/tether-usdt-logo.png";

import { fetchMarketViewRawWeb3 } from "@/utils/chain/helper";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "@/utils/chain/solana";
import {
  SOL_FEED_ID,
  USDC_FEED_ID,
  USDT_FEED_ID,
} from "@/constants/pricefeedids";
import { usePythPrice } from "@/hooks/usePrice";
import { getDecimalsBySymbol } from "@/utils/token";
import numberFormatter from "@/utils/numberFormatter";

// Static base metadata per market (icon, symbol text etc.)
export const markets = [
  {
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
    mintAddress: "AKsF9fzPfmV48SmC6TxFXa4XWo1Ck6sjcF3DkWH6QXJf",
  },
  {
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
    mintAddress: "qZRfe9iy2zNhUnLK9FPDh2bxF7g5vDx3FcyXb4Di72Q",
  },
  {
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
    mintAddress: "AKss9fzPfmV48SmC6TxFXa4XWo1Ck6sjcF3DkWH6QXJf",
  },
];

export default function MarketDashboard() {
  // which filter tab is active (future use)
  const [currentSelectedTab, setCurrentSelectedTab] = useState<
    "All" | "Shared" | "Isolated" | "Cross"
  >("All");

  // Pyth oracle prices
  const sol = usePythPrice(SOL_FEED_ID);
  const usdc = usePythPrice(USDC_FEED_ID);
  const usdt = usePythPrice(USDT_FEED_ID);

  // build symbol -> live price map
  // NOTE: protect against undefined
  const livePricesBySymbol: Record<string, number> = {
    SOL: sol?.price ?? 0,
    USDT: usdt?.price ?? 0,
    USDC: usdc?.price ?? 0,
  };

  // action drawer panel
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

  const router = useRouter();

  // on-chain market stats / APY calc
  const [marketRows, setMarketRows] = useState<any[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState<boolean>(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  async function buildEnrichedMarketsForUser() {
    // You can wire wallet -> PublicKey here if/when you have it.
    // For now, because no wallet address provided, we'll skip user position math
    // and just compute market-level stats.

    const connection = getConnection();
    const enriched: any[] = [];

    for (const m of markets) {
      try {
        const mintPk = new PublicKey(m.mintAddress);

        // fetch on-chain data about this market
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
          totalDeposits > 0 ? totalBorrows / totalDeposits : 0;

        // simple toy rate model
        const baseRate = 0.02;
        const slope1 = 0.2; // linear up to 100%
        const borrowApr = baseRate + slope1 * utilization;
        const supplyApr = borrowApr * utilization * (1 - reserveFactor);

        enriched.push({
          ...m,
          supplyAprPct: (supplyApr * 100).toFixed(2), // string with 2 decimals
          borrowAprPct: (borrowApr * 100).toFixed(2),
          totalSupplyUi: totalDeposits, // raw number from market
          totalBorrowUi: totalBorrows, // raw number from market
          utilizationPct: utilization * 100,
          maxLtv: maxLtv.toFixed(0),
        });
      } catch (err: any) {
        // if this one asset fails, still push something so UI doesn't explode
        enriched.push({
          ...m,
          supplyAprPct: 0,
          borrowAprPct: 0,
          totalSupplyUi: 0,
          totalBorrowUi: 0,
          utilizationPct: 0,
          maxLtv: 0,
        });
      }
    }

    return enriched;
  }

  // load market data on mount
  useEffect(() => {
    (async () => {
      try {
        setIsRowsLoading(true);
        setRowsError(null);
        const rows = await buildEnrichedMarketsForUser();
        setMarketRows(rows);
      } catch (e: any) {
        setRowsError(e?.message || "Failed to load markets");
        setMarketRows([]);
      } finally {
        setIsRowsLoading(false);
      }
    })();
  }, []);

  // current tab filter, but applied after enrichment so APY etc. comes along
  const filteredMarkets = useMemo(() => {
    if (currentSelectedTab === "All") return marketRows;
    return marketRows.filter((m) => m.tier === currentSelectedTab);
  }, [currentSelectedTab, marketRows]);

  // overall loading state for the table:
  // If we don't yet have enriched rows OR all oracle prices are still missing,
  // we treat it as loading.
  const oracleLoading =
    livePricesBySymbol.SOL === undefined ||
    livePricesBySymbol.USDC === undefined ||
    livePricesBySymbol.USDT === undefined;

  const isLoading = isRowsLoading || oracleLoading;

  return (
    <div className="min-h-screen bg-[#181818] w-[96%] ml-[2%] rounded-md text-white">
      <main className="mx-auto max-w-7xl rounded-md">
        {/* FLEX LAYOUT: table on left, action panel on right */}
        <div className="flex w-full gap-6">
          {/* LEFT SIDE (table) */}
          <div
            className={
              actionPanel
                ? "w-[65%] flex flex-col gap-4"
                : "w-full flex flex-col gap-4"
            }
          >
            <div className="rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#2a2a2a] text-left">
                    <tr>
                      <th className="py-5 px-6 text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Assets
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Total Supply
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Total Borrow
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Supply APY
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Borrow APR
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide">
                        Max LTV
                      </th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide"></th>
                      <th className="py-5 px-6 text-right text-[#9CA3AF] font-semibold text-xs uppercase tracking-wide"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* LOADING STATE ROW */}
                    {isLoading && (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-10 px-6 text-center text-gray-400 text-sm"
                        >
                          <div className="flex flex-col items-center justify-center gap-3">
                            {/* spinner */}
                            <div className="h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            <div>Loading market data…</div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ERROR STATE ROW */}
                    {!isLoading && rowsError && (
                      <tr>
                        <td
                          colSpan={8}
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
                        // grab live price for this asset
                        const livePx = livePricesBySymbol[m.name];
                        const displayPx =
                          livePx !== undefined
                            ? `$${livePx.toFixed(2)}`
                            : "—";

                        // NOTE: you are dividing totalSupply/totalBorrow by 1e9.
                        // If those UIs are already in "whole tokens" you may not
                        // want /1e9. Keeping your logic as-is.
                        return (
                          <tr
                            key={`${m.name}-${i}`}
                            className="border-b border-[#2a2a2a] hover:bg-[#222222]/40 transition-colors"
                          >
                            {/* Asset cell */}
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

                            {/* total supply */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {numberFormatter((m.totalSupplyUi / 10 ** getDecimalsBySymbol(m.name)))}
                            </td>

                            {/* total borrow */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {numberFormatter(m.totalBorrowUi / 10 ** (getDecimalsBySymbol(m.name)))}
                            </td>

                            {/* supply apy */}
                            <td className="py-5 px-6 text-right text-[#FECD6D] font-semibold text-sm">
                              {m.supplyAprPct}%
                            </td>

                            {/* borrow apr */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              {m.borrowAprPct}%
                            </td>

                            {/* max ltv */}
                            <td className="py-5 px-6 text-right text-white font-medium text-sm">
                              {m.maxLtv}%
                            </td>

                            {/* Borrow button */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              <Button
                                className="bg-transparent text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                onClick={() =>
                                  setActionPanel({
                                    type: "borrow",
                                    asset: String(m.name),
                                    mintAddress: m.mintAddress,
                                  })
                                }
                              >
                                Borrow
                              </Button>
                            </td>

                            {/* Supply button */}
                            <td className="py-5 px-6 text-right text-white text-sm">
                              <Button
                                className="bg-[#FECD6D] hover:bg-[#fece6dd5] text-black cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                onClick={() =>
                                  setActionPanel({
                                    type: "supply",
                                    asset: String(m.name),
                                    mintAddress: m.mintAddress,
                                  })
                                }
                              >
                                Supply
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                    {/* EMPTY STATE (no markets after filter) */}
                    {!isLoading &&
                      !rowsError &&
                      filteredMarkets.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
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

          {/* RIGHT SIDE (Action Panel dock) */}
          {actionPanel && (
            <div className="w-[35%] space-y-6">
              {actionPanel && (
                <ActionPanel
                  actionPanel={actionPanel}
                  onClose={() => setActionPanel(null)}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

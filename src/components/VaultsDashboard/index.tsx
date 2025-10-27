"use client";

import React, { useMemo, useState } from "react";
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
  },
];

export default function VaultDashboard() {
  const [currentSelectedTab, setCurrentSelectedTab] = useState<
    "All" | "Shared" | "Isolated" | "Cross"
  >("All");

  // action panel state (same shape we used in MarketDashboard)
  const [actionPanel, setActionPanel] = useState<null | {
    type:
      | "supply"
      | "withdraw"
      | "repay"
      | "spend"
      | "addCollateral"
      | "borrow";
    asset: string;
  }>(null);

  const filteredMarkets = useMemo(() => {
    if (currentSelectedTab === "All") return markets;
    return markets.filter((m) => m.tier === currentSelectedTab);
  }, [currentSelectedTab]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#181818] w-[96%] ml-[2%] rounded-md text-white">
      <main className="mx-auto max-w-7xl rounded-md">
        {/* FLEX LAYOUT just like MarketDashboard */}
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
                    {filteredMarkets.map((m, i) => (
                      <tr
                        key={`${m.name}-${i}`}
                        className="border-b border-[#2a2a2a] hover:bg-[#222222]/40 transition-colors cursor-pointer"
                        onClick={() => {
                          // OLD:
                          // router.push(`/lend-borrow/${m.name}`);

                          // NEW:
                          // open the side panel for that vault
                          setActionPanel({
                            type: "supply", // or "borrow" or "spend" depending on what you want this row to mean
                            asset: String(m.name),
                          });
                        }}
                      >
                        {/* Organisation cell */}
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
                                {m.organization}
                              </span>
                            </div>
                          </div>
                        </td>

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
                                {m.symbol}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Deposit (your "apy") */}
                        <td className="py-5 px-6 text-right text-[#FECD6D] font-semibold text-sm">
                          {m.apy}
                        </td>

                        {/* Borrow (your "apr") */}
                        <td className="py-5 px-6 text-right text-white text-sm">
                          {m.apr}
                        </td>

                        {/* LTV (you used totalSupply here in original mock) */}
                        <td className="py-5 px-6 text-right text-white text-sm">
                          {m.totalSupply}
                        </td>

                        {/* Deposit APR (you used totalBorrow in original mock) */}
                        <td className="py-5 px-6 text-right text-white text-sm">
                          {m.totalBorrow}
                        </td>
                        <td className="py-5 px-6 text-right text-white text-sm">
                          <Button
                            className="bg-[#FECD6D] hover:bg-[#fece6dd5] text-black cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                            onClick={() =>
                              setActionPanel({
                                type: "supply",
                                asset: String(m.name),
                              })
                            }
                          >
                            Supply
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {filteredMarkets.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
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

          {/* RIGHT SIDE: action panel dock (only shown when actionPanel != null) */}
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

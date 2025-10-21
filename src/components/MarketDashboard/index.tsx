"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import btcicon from "../../assets/cryptoIcons/bitcoin-btc-logo.png";
import ethicon from "../../assets/cryptoIcons/ethereum-eth-logo.png";
import solicon from "../../assets/cryptoIcons/solana-sol-logo.png";
import usdcicon from "../../assets/cryptoIcons/usd-coin-usdc-logo.png";
import usdticon from "../../assets/cryptoIcons/tether-usdt-logo.png";
import suiicon from "../../assets/cryptoIcons/sui-sui-logo.png";
import { useRouter } from "next/navigation";
import { filter } from "@/interfaces/interface";

const markets = [
  // {
  //   name: "BTC",
  //   symbol: "Bitcoin",
  //   price: "$123,469.75",
  //   apy: "+0.16%",
  //   apr: "1.73%",
  //   totalSupply: "$3.86M",
  //   totalBorrow: "$468.98K",
  //   tier: "Shared",
  //   rewards: false,
  //   icon: btcicon,
  // },
  // {
  //   name: "ETH",
  //   symbol: "Ethereum",
  //   price: "$4,543.91",
  //   apy: "+4.52%",
  //   apr: "0.19%",
  //   totalSupply: "$20.69M",
  //   totalBorrow: "$1.89M",
  //   tier: "Shared",
  //   rewards: true,
  //   icon: ethicon,
  // },
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
  },
  // {
  //   name: "SUI",
  //   symbol: "SUI",
  //   price: "$0.9992",
  //   apy: "+8.28%",
  //   apr: "4.43%",
  //   totalSupply: "$57.89K",
  //   totalBorrow: "$35.92K",
  //   tier: "Cross",
  //   rewards: true,
  //   icon: suiicon,
  // },
];

export default function MarketDashboard() {
  const [currentSelectedTab, setCurrentSelectedTab] = useState<filter>("All");
  const router = useRouter();
  const filters: filter[] = ["All", "Shared", "Isolated", "Cross"];

  // Filtered list derived from currentSelectedTab
  const filteredMarkets = useMemo(() => {
    if (currentSelectedTab === "All") return markets;
    return markets.filter((m) => m.tier === currentSelectedTab);
  }, [currentSelectedTab]);

  return (
    <div className="flex flex-col pt-4 w-full min-h-screen  text-slate-900">
      {/* Header */}

      {/* Filters */}

      {/* Market Table */}
      <Card className="mt-0 mx-8 rounded-xl shadow-sm border border-slate-200 bg-white">
        <div className="flex gap-3 px-5">
          {filters.map((tab) => (
            <button
              key={tab}
              onClick={() => setCurrentSelectedTab(tab)}
              className={`px-5 py-2 rounded-md border text-sm cursor-pointer font-medium ${
                tab === currentSelectedTab
                  ? "bg-slate-200 text-slate-900 border-slate-300"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-slate-700">
            <thead className="border-b border-t border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3 px-6 text-left">Market</th>
                <th className="py-3 px-6 text-right">Price</th>
                <th className="py-3 px-6 text-center">Asset Tier</th>
                <th className="py-3 px-6 text-right">Supply APY</th>
                <th className="py-3 px-6 text-right">Borrow APR</th>
                <th className="py-3 px-6 text-right">Total Supply</th>
                <th className="py-3 px-6 text-right">Total Borrow</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarkets.map((m, i) => (
                <tr
                  key={`${m.name}-${i}`}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => router.replace(`/lend-borrow/${m.name}`)}
                >
                  <td className="py-4 px-6 flex items-center gap-2">
                    <div className="flex flex-col">
                      <div className="flex gap-2 items-center">
                        <div className="w-5 h-5 relative">
                          <Image
                            src={m.icon}
                            alt={m.name}
                            fill
                            className="object-contain"
                          />
                        </div>

                        <div className="flex flex-col">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs text-slate-500">
                            {m.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* {m.rewards && (
                      <Badge className="ml-2 bg-red-100 text-red-600 text-[10px] font-medium">
                        Rewards
                      </Badge>
                    )} */}
                  </td>
                  <td className="py-4 px-6 text-right">{m.price}</td>
                  <td className="py-4 px-6 text-center">
                    <Badge
                      className={`${
                        m.tier === "Cross"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      } text-[10px]`}
                    >
                      {m.tier}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-right text-rose-500">
                    {m.apy}
                  </td>
                  <td className="py-4 px-6 text-right">{m.apr}</td>
                  <td className="py-4 px-6 text-right">{m.totalSupply}</td>
                  <td className="py-4 px-6 text-right">{m.totalBorrow}</td>
                </tr>
              ))}
              {filteredMarkets.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-6 text-center text-slate-500"
                  >
                    No markets found for {currentSelectedTab}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

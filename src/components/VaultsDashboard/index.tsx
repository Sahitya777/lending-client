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

export default function VaultDashboard() {
  const [currentSelectedTab, setCurrentSelectedTab] = useState<
    "All" | "Shared" | "Isolated" | "Cross"
  >("All");
  const filters: ("All" | "Shared" | "Isolated" | "Cross")[] = [
    "All",
    "Shared",
    "Isolated",
    "Cross",
  ];

  const filteredMarkets = useMemo(() => {
    if (currentSelectedTab === "All") return markets;
    return markets.filter((m) => m.tier === currentSelectedTab);
  }, [currentSelectedTab]);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#181818] w-[96%] ml-[2%] rounded-md text-foreground">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl rounded-md">
        <Card className="backdrop-blur-sm min-h-screen rounded-md bg-transparent shadow-lg p-0">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="py-5 px-6 text-left text-muted-foreground font-semibold">
                    Organisations
                  </th>
                  <th className="py-5 px-6 text-left text-muted-foreground font-semibold">
                    Assets
                  </th>
                  <th className="py-5 px-6 text-right text-muted-foreground font-semibold">
                    Deposit
                  </th>
                  <th className="py-5 px-6 text-right text-muted-foreground font-semibold">
                    Borrow
                  </th>
                  <th className="py-5 px-6 text-right text-muted-foreground font-semibold">
                    LTV
                  </th>
                  <th className="py-5 px-6 text-right text-muted-foreground font-semibold">
                    Deposit APR
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map((m, i) => (
                  <tr
                    key={`${m.name}-${i}`}
                    className="border-b border-border hover:bg-secondary/10 transition-colors cursor-pointer"
                    onClick={() => {
                      router.push(`/lend-borrow/${m.name}`);
                    }}
                  >
                    <td className="py-5 px-6 flex items-center gap-3">
                      <div className="w-5 h-5 relative">
                        <Image
                          src={m.icon}
                          alt={m.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {m.organization}
                        </span>
                      </div>
                    </td>
                    <td className="text-right text-foreground font-medium">
                      <div className="py-5 px-6 flex items-center gap-3">
                        <div className="w-5 h-5 relative">
                          <Image
                            src={m.icon}
                            alt={m.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {m.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right text-white font-semibold">
                      {m.apy}
                    </td>
                    <td className="py-5 px-6 text-right text-foreground">
                      {m.apr}
                    </td>
                    <td className="py-5 px-6 text-right text-foreground">
                      {m.totalSupply}
                    </td>
                    <td className="py-5 px-6 text-right text-foreground">
                      {m.totalBorrow}
                    </td>
                  </tr>
                ))}
                {filteredMarkets.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 px-6 text-center text-muted-foreground"
                    >
                      No markets found for {currentSelectedTab}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

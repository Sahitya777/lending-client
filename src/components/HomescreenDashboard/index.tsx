'use client'
import React from "react";
import {
  TrendingUp,
  Wallet2,
  BarChart3,
  ArrowUpRight,
  ChevronUp,
  Info,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import Image from "next/image";
import depositPoolIcon from "../../assets/icons/depositIllust.png";
import lendingIcon from "../../assets/icons/lendingIlust.png";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
/**
 * HomeScreenDashboard
 * ------------------------------------------------------------------
 * A responsive React + Tailwind dashboard that mirrors the layout in
 * the provided screenshot. Values are driven from a simple `data` prop
 * with sensible defaults, so you can wire real data later.
 *
 * Usage:
 *   <HomeScreenDashboard />  // uses defaults
 *   <HomeScreenDashboard data={{ netWorth: 0.18, ... }} />
 */
export default function HomeScreenDashboard({ data }: { data: any }) {
  const d = {
    netWorth: 0.18,
    yieldingPositions: 0.16,
    projected30D: 0.0, // < $0.01 visualized
    lendBorrow: {
      total: 0.08,
      healthFactor: 1.82,
      netAPY: 39.97,
      proj30D: 0.0,
      rows: [
        { market: "shMON", assets: 0.09, debt: 0.06 },
        { market: "gMON", assets: 0.06, debt: 0.0 },
        { market: "WMON", assets: 0.0, debt: 0.01 },
      ],
    },
    wallet: {
      total: 0.09,
      rows: [
        { market: "MON", price: 3.29, amount: 31.2273, value: 102.85 },
        { market: "shMON", price: 3.34, amount: 0.02, value: 0.06 },
        { market: "USDT", price: 1.0, amount: 0.0301, value: 0.03 },
      ],
    },
    yieldOpps: [
      { label: "Lend NSTR", apy: 149.28 },
      { label: "Lend USDT", apy: 128.94 },
      { label: "Lend $MON", apy: 128.61 },
    ],
  };

  // Merge incoming data (shallow)
  const merged = { ...d, ...(data || {}) };
    const { user } = useDynamicContext();
  return (
    <div className="w-full min-h-screen bg-white text-gray-900 rounded-md">
      {/* Page container */}
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            icon={<Wallet2 className="h-6 w-6" />}
            title="Net Worth"
            value={`$${merged.netWorth.toFixed(2)}`}
            highlight={undefined}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Yielding positions"
            value={`$${merged.yieldingPositions.toFixed(2)}`}
            highlight={undefined}
          />
          <KpiCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="30D projected yield"
            value={"<$0.01"}
            highlight
          />
        </div>

        {/* Main two-column grid */}
        <div className="mt-6 flex justify-between w-full">
          {/* Lend & Borrow (spans 2 cols) */}
          <div className="flex flex-col gap-2 w-[62%]">
            {user &&<div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-semibold">Lend & Borrow</h2>
                <div className="text-sm font-medium text-gray-600">
                  ${merged.lendBorrow.total.toFixed(2)}
                </div>
              </div>

              {/* summary band */}
              <div className="px-5 pt-5">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                  <SummaryPill
                    label="Health factor"
                    value={merged.lendBorrow.healthFactor.toFixed(2)}
                    valueClass="text-emerald-600"
                  />
                  <SummaryPill
                    label="Net APY"
                    value={`${merged.lendBorrow.netAPY.toFixed(2)}%"`}
                    valueClass="text-emerald-600"
                  />
                  <SummaryPill
                    label="30D projected yield"
                    value="<$0.01"
                    valueClass="text-gray-700"
                  />
                  <div className="flex justify-start sm:justify-end">
                    <button className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white text-sm px-4 py-2 shadow hover:shadow-md transition">
                      Manage <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* table */}
              <div className="p-5">
                <div className="grid grid-cols-3 text-xs font-medium text-gray-500 px-3 pb-2">
                  <div>Market</div>
                  <div className="text-right">Assets</div>
                  <div className="text-right">Debt</div>
                </div>
                <div className="divide-y">
                  {merged.lendBorrow.rows.map(
                    (
                      r: {
                        market:
                          | boolean
                          | React.ReactElement<
                              unknown,
                              string | React.JSXElementConstructor<any>
                            >
                          | Iterable<React.ReactNode>
                          | Promise<
                              | string
                              | number
                              | bigint
                              | boolean
                              | React.ReactPortal
                              | React.ReactElement<
                                  unknown,
                                  string | React.JSXElementConstructor<any>
                                >
                              | Iterable<React.ReactNode>
                              | null
                              | undefined
                            >
                          | React.Key
                          | null
                          | undefined;
                        assets: number;
                        debt: number;
                      },
                      index: number
                    ) => (
                      <div
                        key={index}
                        className="grid grid-cols-3 items-center px-3 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-3 w-3 rounded-full bg-gray-200 ring-1 ring-gray-300" />
                          <span className="font-medium text-gray-800">
                            {r.market}
                          </span>
                        </div>
                        <div className="text-right text-gray-700">
                          ${r.assets.toFixed(2)}
                        </div>
                        <div className="text-right text-gray-700">
                          ${r.debt.toFixed(2)}
                        </div>
                      </div>
                    )
                  )}
                  <div className="grid grid-cols-3 items-center px-3 py-3 text-sm font-semibold">
                    <div className="text-gray-600">TOTAL</div>
                    <div className="text-right">
                      $
                      {merged.lendBorrow.rows
                        .reduce((a: any, b: { assets: any }) => a + b.assets, 0)
                        .toFixed(2)}
                    </div>
                    <div className="text-right">
                      $
                      {merged.lendBorrow.rows
                        .reduce((a: any, b: { debt: any }) => a + b.debt, 0)
                        .toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>}
            {!user &&<div className="rounded-2xl flex items-center p-2 justify-between border border-gray-200 bg-white shadow-sm">
              <div className="p-5">
                <h2 className="text-lg font-semibold">Lend & Borrow</h2>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-2">
                  No open positions yet
                </p>
                <p className="text-sm text-gray-700 mt-1 max-w-[300px]">
                  Boost your earnings by lending and borrowing against your
                  collateral
                </p>

                <div className="mt-6 flex w-full items-start justify-between">
                  <div className="flex md:justify-end">
                    <button className="rounded-md bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium shadow hover:bg-indigo-700 transition">
                      Deposit now
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <Image src={lendingIcon} alt="Pool" objectFit="contain" />
              </div>
            </div>}
            {!user &&<div className="rounded-2xl flex items-center p-2 justify-between border border-gray-200 bg-white shadow-sm">
              <div className="p-5">
                <h2 className="text-lg font-semibold">Pools</h2>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-2">
                  No open deposit yet
                </p>
                <p className="text-sm text-gray-700 mt-1 max-w-[300px]">
                  Deposit crypto into liquidity pools to earn swap fees and
                  yield
                </p>

                <div className="mt-6 flex w-full items-start justify-between">
                  <div className="flex md:justify-end">
                    <button className="rounded-md bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium shadow hover:bg-indigo-700 transition">
                      Deposit now
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <Image src={depositPoolIcon} alt="Pool" objectFit="contain" />
              </div>
            </div>}
          </div>

          {/* Right column */}
          <div className="space-y-6 w-[35%]">
            {/* Wallet */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-semibold">Wallet</h2>
                <div className="text-sm font-medium text-gray-600">
                  ${merged.wallet.total.toFixed(2)}
                </div>
              </div>
              <div className="px-5 pb-5">
                <div className="grid grid-cols-4 text-xs font-medium text-gray-500 px-1 pt-4 pb-2">
                  <div>Market</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Value</div>
                </div>
                <div className="divide-y">
                  {merged.wallet.rows.map((r: any) => (
                    <div
                      key={r.market}
                      className="grid grid-cols-4 items-center px-1 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-5 w-5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-300" />
                        <span className="font-medium text-gray-800">
                          {r.market}
                        </span>
                      </div>
                      <div className="text-right">${r.price.toFixed(2)}</div>
                      <div className="text-right">{r.amount.toFixed(4)}</div>
                      <div className="text-right">${r.value.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Yield opportunities */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-semibold">Yield opportunities</h2>
                <button
                  className="rounded-lg p-1 hover:bg-gray-100 transition"
                  aria-label="collapse"
                >
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <div className="p-2">
                {merged.yieldOpps.map((op: any) => (
                  <div
                    key={op.label}
                    className="flex items-center justify-between px-3 py-3 text-sm hover:bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-gray-300">
                        <Circle className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{op.label}</span>
                    </div>
                    <div className="text-right font-medium">
                      {op.apy.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pools */}
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value, highlight }: any) {
  return (
    <div
      className={`rounded-2xl border ${
        highlight
          ? "border-indigo-400 ring-2 ring-indigo-200"
          : "border-gray-200"
      } bg-white shadow-sm p-5 flex items-center gap-4`}
    >
      <div
        className={`grid h-12 w-12 place-items-center rounded-2xl ${
          highlight ? "bg-indigo-50" : "bg-gray-50"
        } border ${highlight ? "border-indigo-100" : "border-gray-200"}`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-600">{title}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, valueClass }: any) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <div
          className={`text-base font-semibold ${valueClass || "text-gray-900"}`}
        >
          {value}
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function IllustrationCard() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="grid grid-cols-2 gap-6 items-center">
        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50"></div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50"></div>
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        Illustrative wiring between a wallet and a protocol module
      </div>
    </div>
  );
}

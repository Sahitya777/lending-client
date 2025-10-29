"use client";

import type React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import Image from "next/image";
import depositPoolIcon from "../../assets/icons/depositIllust.png";
import lendingIcon from "../../assets/icons/lendingIlust.png";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import DevnetWalletPanel from "../DevnetPanelWallet";
import { Button } from "../ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { KpiCard } from "./components/KpiCard";
import { ActionPanel } from "./components/ActionPanel";
import { PublicKey } from "@solana/web3.js";
import { markets } from "../MarketDashboard";
import { getConnection } from "@/utils/chain/solana";
import {
  fetchMarketViewRawWeb3,
  fetchUserPositionViewRawWeb3,
} from "@/utils/chain/helper";
import { getTokenIcon } from "@/utils/helper";
import { usePythPrice } from "@/hooks/usePrice";
import { BTC_FEED_ID, SOL_FEED_ID, USDC_FEED_ID, USDT_FEED_ID } from "@/constants/pricefeedids";

export default function HomeScreenDashboard({ data }: { data: any }) {
  // Mock data fallback
  const d = {
    netWorth: 0,
    yieldingPositions: 0,
    projected30D: 0.0,
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

  const merged = { ...d, ...(data || {}) };
  const { user, primaryWallet } = useDynamicContext();
  const sol = usePythPrice(SOL_FEED_ID);
  const usdc = usePythPrice(USDC_FEED_ID);
  const usdt=usePythPrice(USDT_FEED_ID)

  const [showSupplyPositions, setshowSupplyPositions] = useState(true);
  const [showDebtPositions, setshowDebtPositions] = useState(true);
    const livePricesBySymbol: Record<string, number> = {
    SOL: sol?.price ?? 0,
    USDT: usdt?.price ?? 0,
    USDC: usdc?.price ?? 0,
  };

  // this controls the right-side "action drawer"
  const [actionPanel, setActionPanel] = useState<null | {
    type: "supply" | "withdraw" | "repay" | "spend" | "addCollateral";
    asset: string;
    mintAddress: string;
  }>(null);
  const [marketRows, setMarketRows] = useState<any[]>([]);
  const [hasAnySupply, setHasAnySupply] = useState(false);
  const [netWorth, setNetWorth] = useState(0);
  const [hasAnyBorrow, setHasAnyBorrow] = useState(false);

  async function buildEnrichedMarketsForUser(walletAddress: string) {
    // turn wallet -> PublicKey
    let ownerPk: PublicKey;
    try {
      ownerPk = new PublicKey(walletAddress);
    } catch {
      // bad/invalid pubkey? just return zeroed markets
      return markets.map((m) => ({
        ...m,
        userSupplyUsd: 0,
        supplyAprPct: 0,
        totalSupplyUi: 0,
        totalBorrowUi: 0,
        userBorrowUsd: 0,
      }));
    }

    const connection = getConnection();

    const enriched = [];

    for (const m of markets) {
      const mintPk = new PublicKey(m.mintAddress);

      // 1. read user position in this market
      const userPos = await fetchUserPositionViewRawWeb3({
        owner: ownerPk,
        marketMint: mintPk,
        connection,
        commitment: "confirmed",
      });

      // how much user deposited here (shares)
      const userShares = userPos.depositedSharesUi ?? 0;

      // NOTE: userShares is not USD yet. For now we will just show this number
      // as "Amount" and "$Amount". You can multiply by price later.

      // 2. read market stats
      const mv = await fetchMarketViewRawWeb3({
        marketMint: mintPk,
        connection,
        commitment: "confirmed",
      });

      const totalDeposits = Number(mv.totalDepositsUi);
      const totalBorrows = Number(mv.totalBorrowsUi);
      const reserveFactor = Number(mv.reserveFactorRaw) / 10000; // assume bps

      const utilization = totalDeposits > 0 ? totalBorrows / totalDeposits : 0; // 0..1

      // aprs
      const baseRate = 0.02;
      const slope1 = 0.2; // linear up to 100%
      const borrowApr = baseRate + slope1 * utilization;
      const supplyApr = borrowApr * utilization * (1 - reserveFactor);

      enriched.push({
        ...m,
        userSupplyUsd: userShares, // number
        supplyAprPct: supplyApr * 100, // % for UI
        totalSupplyUi: totalDeposits, // number
        totalBorrowUi: totalBorrows, // number
        utilizationPct: utilization * 100, // optional, handy for later
      });
    }

    return enriched;
  }

  useEffect(() => {
    (async () => {
      if (
        !primaryWallet ||
        !("address" in primaryWallet) ||
        !primaryWallet.address
      ) {
        setMarketRows([]);
        return;
      }

      const rows = await buildEnrichedMarketsForUser(primaryWallet.address);
      setMarketRows(rows);
      const anySupply = rows.some((r) => (r.userSupplyUsd ?? 0) > 0);
      setHasAnySupply(anySupply);
      const suppliedTotal = rows.reduce((acc, r) => {
              const livePx = livePricesBySymbol[r.name];
          if (livePx === undefined || livePx === null) return acc;
          return acc + (r.userSupplyUsd)
        },0
      );
      setNetWorth(suppliedTotal / 10 ** 9);
    })();
  }, [primaryWallet]);

    const totalSupply = useMemo(() => {
      return marketRows.reduce((acc, row) => {
        const livePx = livePricesBySymbol[row.name];
        if (livePx === undefined || livePx === null) return acc;
        return acc + (row.userSupplyUsd/ 10 ** 9 * livePx);
      }, 0);
    }, [marketRows, livePricesBySymbol]);


  return (
    <div className="w-[96%] ml-[2%] min-h-screen bg-[#181818] text-white rounded-md">
      <div className="mx-auto max-w-7xl p-6 lg:p-4">
        {/* Top KPI Cards */}
        {!actionPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21.75 18.6234V22.5C21.75 22.6989 21.671 22.8897 21.5303 23.0303C21.3897 23.171 21.1989 23.25 21 23.25C20.8011 23.25 20.6103 23.171 20.4697 23.0303C20.329 22.8897 20.25 22.6989 20.25 22.5V18.6234C20.2465 17.6608 20.0449 16.7091 19.6579 15.8277C19.2708 14.9463 18.7065 14.1539 18 13.5V18.9703C17.9999 19.1317 17.9477 19.2888 17.8512 19.4181C17.7546 19.5475 17.619 19.6423 17.4643 19.6884C17.3096 19.7345 17.1442 19.7295 16.9926 19.6741C16.841 19.6187 16.7113 19.5159 16.6228 19.3809L15.6216 17.8519C15.6141 17.8406 15.6066 17.8284 15.6 17.8162C15.4529 17.5565 15.2087 17.3659 14.9211 17.2863C14.6334 17.2066 14.326 17.2445 14.0662 17.3916C13.8065 17.5386 13.6159 17.7828 13.5363 18.0705C13.4566 18.3581 13.4945 18.6656 13.6416 18.9253L15.7162 22.0931C15.8252 22.2596 15.8635 22.4625 15.8228 22.6572C15.7821 22.8519 15.6657 23.0225 15.4992 23.1314C15.3328 23.2403 15.1298 23.2786 14.9351 23.2379C14.7404 23.1972 14.5698 23.0808 14.4609 22.9144L12.3741 19.7269L12.3516 19.6912C12.0285 19.1376 11.9192 18.485 12.0442 17.8563C12.1692 17.2277 12.5199 16.6665 13.0301 16.2786C13.5404 15.8906 14.175 15.7028 14.8141 15.7505C15.4533 15.7982 16.053 16.0781 16.5 16.5375V6H15C14.8011 6 14.6103 5.92098 14.4697 5.78033C14.329 5.63968 14.25 5.44891 14.25 5.25C14.25 5.05109 14.329 4.86032 14.4697 4.71967C14.6103 4.57902 14.8011 4.5 15 4.5H16.5C16.8978 4.5 17.2794 4.65803 17.5607 4.93934C17.842 5.22064 18 5.60217 18 6V11.5894C19.1512 12.3673 20.0946 13.4149 20.7482 14.6409C21.4018 15.8669 21.7458 17.2341 21.75 18.6234ZM8.25 5.25C8.25 5.05109 8.17098 4.86032 8.03033 4.71967C7.88968 4.57902 7.69891 4.5 7.5 4.5H6C5.60218 4.5 5.22064 4.65803 4.93934 4.93934C4.65804 5.22064 4.5 5.60217 4.5 6V18.75C4.5 18.9489 4.57902 19.1397 4.71967 19.2803C4.86032 19.421 5.05109 19.5 5.25 19.5C5.44891 19.5 5.63968 19.421 5.78033 19.2803C5.92098 19.1397 6 18.9489 6 18.75V6H7.5C7.69891 6 7.88968 5.92098 8.03033 5.78033C8.17098 5.63968 8.25 5.44891 8.25 5.25ZM14.7806 9.21937C14.711 9.14964 14.6283 9.09432 14.5372 9.05658C14.4462 9.01884 14.3486 8.99941 14.25 8.99941C14.1514 8.99941 14.0538 9.01884 13.9628 9.05658C13.8717 9.09432 13.789 9.14964 13.7194 9.21937L12 10.9397V1.5C12 1.30109 11.921 1.11032 11.7803 0.96967C11.6397 0.829018 11.4489 0.75 11.25 0.75C11.0511 0.75 10.8603 0.829018 10.7197 0.96967C10.579 1.11032 10.5 1.30109 10.5 1.5V10.9397L8.78063 9.21937C8.63989 9.07864 8.44902 8.99958 8.25 8.99958C8.05098 8.99958 7.86011 9.07864 7.71937 9.21937C7.57864 9.3601 7.49958 9.55098 7.49958 9.75C7.49958 9.94902 7.57864 10.1399 7.71937 10.2806L10.7194 13.2806C10.789 13.3504 10.8717 13.4057 10.9628 13.4434C11.0538 13.4812 11.1514 13.5006 11.25 13.5006C11.3486 13.5006 11.4462 13.4812 11.5372 13.4434C11.6283 13.4057 11.711 13.3504 11.7806 13.2806L14.7806 10.2806C14.8504 10.211 14.9057 10.1283 14.9434 10.0372C14.9812 9.94616 15.0006 9.84856 15.0006 9.75C15.0006 9.65144 14.9812 9.55384 14.9434 9.46279C14.9057 9.37175 14.8504 9.28903 14.7806 9.21937Z"
                    fill="#FCFCFC"
                  />
                </svg>
              }
              title="Net Worth"
              value={`$${totalSupply.toFixed(4)}`}
              highlight={undefined}
            />
            <KpiCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.75 15V21.75C12.75 21.9489 12.671 22.1397 12.5303 22.2803C12.3897 22.421 12.1989 22.5 12 22.5C11.8011 22.5 11.6103 22.421 11.4697 22.2803C11.329 22.1397 11.25 21.9489 11.25 21.75V15C11.25 14.8011 11.329 14.6103 11.4697 14.4697C11.6103 14.329 11.8011 14.25 12 14.25C12.1989 14.25 12.3897 14.329 12.5303 14.4697C12.671 14.6103 12.75 14.8011 12.75 15ZM19.5 9H13.8103L17.7806 5.03062C17.9214 4.88989 18.0004 4.69902 18.0004 4.5C18.0004 4.30098 17.9214 4.11011 17.7806 3.96938C17.6399 3.82864 17.449 3.74958 17.25 3.74958C17.051 3.74958 16.8601 3.82864 16.7194 3.96938L12.75 7.93969V2.25C12.75 2.05109 12.671 1.86032 12.5303 1.71967C12.3897 1.57902 12.1989 1.5 12 1.5C11.8011 1.5 11.6103 1.57902 11.4697 1.71967C11.329 1.86032 11.25 2.05109 11.25 2.25V7.93969L7.28063 3.96938C7.13989 3.82864 6.94902 3.74958 6.75 3.74958C6.55098 3.74958 6.36011 3.82864 6.21938 3.96938C6.07864 4.11011 5.99958 4.30098 5.99958 4.5C5.99958 4.69902 6.07864 4.88989 6.21937 5.03062L10.1897 9H4.5C4.30109 9 4.11032 9.07902 3.96967 9.21967C3.82902 9.36032 3.75 9.55109 3.75 9.75C3.75 9.94891 3.82902 10.1397 3.96967 10.2803C4.11032 10.421 4.30109 10.5 4.5 10.5H10.1897L6.21937 14.4694C6.07864 14.6101 5.99958 14.801 5.99958 15C5.99958 15.199 6.07864 15.3899 6.21937 15.5306C6.36011 15.6714 6.55098 15.7504 6.75 15.7504C6.94902 15.7504 7.13989 15.6714 7.28063 15.5306L12 10.8103L16.7194 15.5306C16.7891 15.6003 16.8718 15.6556 16.9628 15.6933C17.0539 15.731 17.1515 15.7504 17.25 15.7504C17.3485 15.7504 17.4461 15.731 17.5372 15.6933C17.6282 15.6556 17.7109 15.6003 17.7806 15.5306C17.8503 15.4609 17.9056 15.3782 17.9433 15.2872C17.981 15.1961 18.0004 15.0985 18.0004 15C18.0004 14.9015 17.981 14.8039 17.9433 14.7128C17.9056 14.6218 17.8503 14.5391 17.7806 14.4694L13.8103 10.5H19.5C19.6989 10.5 19.8897 10.421 20.0303 10.2803C20.171 10.1397 20.25 9.94891 20.25 9.75C20.25 9.55109 20.171 9.36032 20.0303 9.21967C19.8897 9.07902 19.6989 9 19.5 9Z"
                    fill="#FCFCFC"
                  />
                </svg>
              }
              title="Yielding positions"
              value={`$${totalSupply.toFixed(4)}`}
              highlight={undefined}
            />
            <KpiCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.1425 2.90137C21.8701 2.61561 21.5467 2.38892 21.1908 2.23426C20.8348 2.0796 20.4533 2 20.0681 2C19.6828 2 19.3013 2.0796 18.9454 2.23426C18.5895 2.38892 18.2661 2.61561 17.9937 2.90137C17.7213 3.18707 17.5051 3.52627 17.3577 3.89959C17.2102 4.27291 17.1343 4.67304 17.1343 5.07712C17.1343 5.48121 17.2102 5.88134 17.3577 6.25466C17.5051 6.62798 17.7213 6.96718 17.9937 7.25288C18.0203 7.28076 18.0487 7.30768 18.0762 7.3346L15.6352 12.0899C14.891 11.8996 14.1053 12.0202 13.4444 12.4264L11.5946 10.4862C11.9585 9.84107 12.0854 9.07875 11.9513 8.34245C11.8172 7.60614 11.4315 6.9465 10.8665 6.48742C10.3015 6.02834 9.59619 5.8014 8.88296 5.84923C8.16973 5.89705 7.49768 6.21635 6.99304 6.74716C6.72059 7.03286 6.50447 7.37205 6.35701 7.74537C6.20956 8.11869 6.13367 8.51882 6.13367 8.92291C6.13367 9.327 6.20956 9.72713 6.35701 10.1004C6.50447 10.4738 6.72059 10.813 6.99304 11.0987C7.01962 11.1265 7.04712 11.1535 7.07462 11.1804L4.63359 15.9367C4.14361 15.8102 3.6308 15.8184 3.14474 15.9605C2.65867 16.1027 2.21579 16.374 1.8589 16.7481C1.44874 17.1784 1.16944 17.7266 1.05631 18.3234C0.943188 18.9202 1.00132 19.5388 1.22335 20.1009C1.44538 20.663 1.82134 21.1435 2.3037 21.4815C2.78606 21.8196 3.35315 22 3.93327 22C4.51339 22 5.08048 21.8196 5.56284 21.4815C6.0452 21.1435 6.42116 20.663 6.6432 20.1009C6.86523 19.5388 6.92335 18.9202 6.81023 18.3234C6.6971 17.7266 6.4178 17.1784 6.00764 16.7481C5.98106 16.7202 5.95264 16.6933 5.92515 16.6664L8.36618 11.9111C8.5957 11.97 8.83111 12.0001 9.06741 12.0005C9.59111 12.0012 10.1054 11.8548 10.557 11.5765L12.4068 13.5167C12.1283 14.0124 11.9879 14.5801 12.0016 15.1553C12.0153 15.7305 12.1825 16.2902 12.4842 16.7707C12.7859 17.2513 13.2101 17.6334 13.7085 17.8738C14.2069 18.1142 14.7596 18.2032 15.3038 18.1306C15.848 18.0581 16.3619 17.8269 16.7871 17.4634C17.2123 17.0999 17.5318 16.6186 17.7094 16.0742C17.8869 15.5298 17.9153 14.944 17.7914 14.3835C17.6675 13.823 17.3962 13.3102 17.0083 12.9033C16.9817 12.8754 16.9542 12.8485 16.9267 12.8216L19.3678 8.06626C19.5967 8.12481 19.8315 8.1545 20.0672 8.15471C20.6472 8.15462 21.2142 7.97416 21.6964 7.63615C22.1787 7.29814 22.5546 6.81775 22.7766 6.25571C22.9986 5.69367 23.0568 5.0752 22.9438 4.47849C22.8307 3.88178 22.5516 3.33362 22.1415 2.90329L22.1425 2.90137ZM4.97 20.0122C4.6948 20.3007 4.32159 20.4628 3.93249 20.4627C3.54338 20.4626 3.17025 20.3004 2.89517 20.0117C2.62009 19.7231 2.4656 19.3317 2.46569 18.9235C2.46577 18.5154 2.62043 18.124 2.89563 17.8355C3.03189 17.6927 3.19365 17.5793 3.37167 17.502C3.54968 17.4248 3.74047 17.385 3.93314 17.385C4.1258 17.3851 4.31657 17.4249 4.49456 17.5023C4.67254 17.5797 4.83425 17.6931 4.97046 17.836C5.10666 17.9789 5.21469 18.1486 5.28838 18.3353C5.36208 18.522 5.39998 18.7221 5.39994 18.9242C5.3999 19.1263 5.36191 19.3264 5.28814 19.5131C5.21437 19.6998 5.10626 19.8694 4.97 20.0122ZM8.02977 10.0132C7.89354 9.87034 7.78548 9.70074 7.71175 9.51408C7.63803 9.32742 7.60008 9.12736 7.60008 8.92531C7.60008 8.72327 7.63803 8.5232 7.71175 8.33654C7.78548 8.14988 7.89354 7.98029 8.02977 7.83744C8.23489 7.62233 8.49622 7.47586 8.78071 7.41653C9.0652 7.3572 9.36008 7.38769 9.62805 7.50413C9.89602 7.62057 10.1251 7.81774 10.2862 8.07071C10.4473 8.32367 10.5334 8.62108 10.5334 8.92531C10.5334 9.22955 10.4473 9.52695 10.2862 9.77992C10.1251 10.0329 9.89602 10.2301 9.62805 10.3465C9.36008 10.4629 9.0652 10.4934 8.78071 10.4341C8.49622 10.3748 8.23489 10.2283 8.02977 10.0132ZM15.9716 16.1664C15.6965 16.455 15.3234 16.6171 14.9344 16.6171C14.5454 16.6171 14.1723 16.455 13.8972 16.1664C13.6221 15.8779 13.4676 15.4866 13.4676 15.0786C13.4676 14.6705 13.6221 14.2792 13.8972 13.9907C14.1723 13.7022 14.5454 13.5401 14.9344 13.5401C15.3234 13.5401 15.6965 13.7022 15.9716 13.9907C16.2467 14.2792 16.4012 14.6705 16.4012 15.0786C16.4012 15.4866 16.2467 15.8779 15.9716 16.1664ZM21.1048 6.1674C20.8294 6.4558 20.456 6.61762 20.0668 6.61725C19.6776 6.61689 19.3045 6.45439 19.0295 6.16548C18.7546 5.87658 18.6003 5.48494 18.6006 5.07673C18.601 4.66851 18.7559 4.27716 19.0314 3.98877C19.1676 3.84591 19.3294 3.73259 19.5074 3.6553C19.6854 3.57801 19.8762 3.53825 20.0689 3.53829C20.2615 3.53834 20.4523 3.57819 20.6303 3.65556C20.8083 3.73294 20.97 3.84632 21.1062 3.98925C21.2424 4.13217 21.3504 4.30184 21.4241 4.48855C21.4978 4.67527 21.5357 4.87538 21.5357 5.07746C21.5356 5.27955 21.4976 5.47964 21.4239 5.66632C21.3501 5.853 21.242 6.02262 21.1057 6.16548L21.1048 6.1674Z"
                    fill="#FCFCFC"
                  />
                </svg>
              }
              title="30D projected yield"
              value={"$0.00"}
            />
          </div>
        )}

        {/* Main two-column grid */}
        <div className={`flex w-full gap-6 ${actionPanel ? "" : "mt-6"}`}>
          {/* LEFT SIDE */}
          {
            <div
              className={
                actionPanel
                  ? "flex flex-col gap-6 w-[65%]"
                  : "flex flex-col gap-6 w-[63.5%]"
              }
            >
              {actionPanel && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard
                    icon={
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M21.75 18.6234V22.5C21.75 22.6989 21.671 22.8897 21.5303 23.0303C21.3897 23.171 21.1989 23.25 21 23.25C20.8011 23.25 20.6103 23.171 20.4697 23.0303C20.329 22.8897 20.25 22.6989 20.25 22.5V18.6234C20.2465 17.6608 20.0449 16.7091 19.6579 15.8277C19.2708 14.9463 18.7065 14.1539 18 13.5V18.9703C17.9999 19.1317 17.9477 19.2888 17.8512 19.4181C17.7546 19.5475 17.619 19.6423 17.4643 19.6884C17.3096 19.7345 17.1442 19.7295 16.9926 19.6741C16.841 19.6187 16.7113 19.5159 16.6228 19.3809L15.6216 17.8519C15.6141 17.8406 15.6066 17.8284 15.6 17.8162C15.4529 17.5565 15.2087 17.3659 14.9211 17.2863C14.6334 17.2066 14.326 17.2445 14.0662 17.3916C13.8065 17.5386 13.6159 17.7828 13.5363 18.0705C13.4566 18.3581 13.4945 18.6656 13.6416 18.9253L15.7162 22.0931C15.8252 22.2596 15.8635 22.4625 15.8228 22.6572C15.7821 22.8519 15.6657 23.0225 15.4992 23.1314C15.3328 23.2403 15.1298 23.2786 14.9351 23.2379C14.7404 23.1972 14.5698 23.0808 14.4609 22.9144L12.3741 19.7269L12.3516 19.6912C12.0285 19.1376 11.9192 18.485 12.0442 17.8563C12.1692 17.2277 12.5199 16.6665 13.0301 16.2786C13.5404 15.8906 14.175 15.7028 14.8141 15.7505C15.4533 15.7982 16.053 16.0781 16.5 16.5375V6H15C14.8011 6 14.6103 5.92098 14.4697 5.78033C14.329 5.63968 14.25 5.44891 14.25 5.25C14.25 5.05109 14.329 4.86032 14.4697 4.71967C14.6103 4.57902 14.8011 4.5 15 4.5H16.5C16.8978 4.5 17.2794 4.65803 17.5607 4.93934C17.842 5.22064 18 5.60217 18 6V11.5894C19.1512 12.3673 20.0946 13.4149 20.7482 14.6409C21.4018 15.8669 21.7458 17.2341 21.75 18.6234ZM8.25 5.25C8.25 5.05109 8.17098 4.86032 8.03033 4.71967C7.88968 4.57902 7.69891 4.5 7.5 4.5H6C5.60218 4.5 5.22064 4.65803 4.93934 4.93934C4.65804 5.22064 4.5 5.60217 4.5 6V18.75C4.5 18.9489 4.57902 19.1397 4.71967 19.2803C4.86032 19.421 5.05109 19.5 5.25 19.5C5.44891 19.5 5.63968 19.421 5.78033 19.2803C5.92098 19.1397 6 18.9489 6 18.75V6H7.5C7.69891 6 7.88968 5.92098 8.03033 5.78033C8.17098 5.63968 8.25 5.44891 8.25 5.25ZM14.7806 9.21937C14.711 9.14964 14.6283 9.09432 14.5372 9.05658C14.4462 9.01884 14.3486 8.99941 14.25 8.99941C14.1514 8.99941 14.0538 9.01884 13.9628 9.05658C13.8717 9.09432 13.789 9.14964 13.7194 9.21937L12 10.9397V1.5C12 1.30109 11.921 1.11032 11.7803 0.96967C11.6397 0.829018 11.4489 0.75 11.25 0.75C11.0511 0.75 10.8603 0.829018 10.7197 0.96967C10.579 1.11032 10.5 1.30109 10.5 1.5V10.9397L8.78063 9.21937C8.63989 9.07864 8.44902 8.99958 8.25 8.99958C8.05098 8.99958 7.86011 9.07864 7.71937 9.21937C7.57864 9.3601 7.49958 9.55098 7.49958 9.75C7.49958 9.94902 7.57864 10.1399 7.71937 10.2806L10.7194 13.2806C10.789 13.3504 10.8717 13.4057 10.9628 13.4434C11.0538 13.4812 11.1514 13.5006 11.25 13.5006C11.3486 13.5006 11.4462 13.4812 11.5372 13.4434C11.6283 13.4057 11.711 13.3504 11.7806 13.2806L14.7806 10.2806C14.8504 10.211 14.9057 10.1283 14.9434 10.0372C14.9812 9.94616 15.0006 9.84856 15.0006 9.75C15.0006 9.65144 14.9812 9.55384 14.9434 9.46279C14.9057 9.37175 14.8504 9.28903 14.7806 9.21937Z"
                          fill="#FCFCFC"
                        />
                      </svg>
                    }
                    title="Net Worth"
                    value={`$${totalSupply.toFixed(4)}`}
                    highlight={undefined}
                  />
                  <KpiCard
                    icon={
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12.75 15V21.75C12.75 21.9489 12.671 22.1397 12.5303 22.2803C12.3897 22.421 12.1989 22.5 12 22.5C11.8011 22.5 11.6103 22.421 11.4697 22.2803C11.329 22.1397 11.25 21.9489 11.25 21.75V15C11.25 14.8011 11.329 14.6103 11.4697 14.4697C11.6103 14.329 11.8011 14.25 12 14.25C12.1989 14.25 12.3897 14.329 12.5303 14.4697C12.671 14.6103 12.75 14.8011 12.75 15ZM19.5 9H13.8103L17.7806 5.03062C17.9214 4.88989 18.0004 4.69902 18.0004 4.5C18.0004 4.30098 17.9214 4.11011 17.7806 3.96938C17.6399 3.82864 17.449 3.74958 17.25 3.74958C17.051 3.74958 16.8601 3.82864 16.7194 3.96938L12.75 7.93969V2.25C12.75 2.05109 12.671 1.86032 12.5303 1.71967C12.3897 1.57902 12.1989 1.5 12 1.5C11.8011 1.5 11.6103 1.57902 11.4697 1.71967C11.329 1.86032 11.25 2.05109 11.25 2.25V7.93969L7.28063 3.96938C7.13989 3.82864 6.94902 3.74958 6.75 3.74958C6.55098 3.74958 6.36011 3.82864 6.21938 3.96938C6.07864 4.11011 5.99958 4.30098 5.99958 4.5C5.99958 4.69902 6.07864 4.88989 6.21937 5.03062L10.1897 9H4.5C4.30109 9 4.11032 9.07902 3.96967 9.21967C3.82902 9.36032 3.75 9.55109 3.75 9.75C3.75 9.94891 3.82902 10.1397 3.96967 10.2803C4.11032 10.421 4.30109 10.5 4.5 10.5H10.1897L6.21937 14.4694C6.07864 14.6101 5.99958 14.801 5.99958 15C5.99958 15.199 6.07864 15.3899 6.21937 15.5306C6.36011 15.6714 6.55098 15.7504 6.75 15.7504C6.94902 15.7504 7.13989 15.6714 7.28063 15.5306L12 10.8103L16.7194 15.5306C16.7891 15.6003 16.8718 15.6556 16.9628 15.6933C17.0539 15.731 17.1515 15.7504 17.25 15.7504C17.3485 15.7504 17.4461 15.731 17.5372 15.6933C17.6282 15.6556 17.7109 15.6003 17.7806 15.5306C17.8503 15.4609 17.9056 15.3782 17.9433 15.2872C17.981 15.1961 18.0004 15.0985 18.0004 15C18.0004 14.9015 17.981 14.8039 17.9433 14.7128C17.9056 14.6218 17.8503 14.5391 17.7806 14.4694L13.8103 10.5H19.5C19.6989 10.5 19.8897 10.421 20.0303 10.2803C20.171 10.1397 20.25 9.94891 20.25 9.75C20.25 9.55109 20.171 9.36032 20.0303 9.21967C19.8897 9.07902 19.6989 9 19.5 9Z"
                          fill="#FCFCFC"
                        />
                      </svg>
                    }
                    title="Yielding positions"
                    value={`$${totalSupply.toFixed(4)}`}
                    highlight={undefined}
                  />
                  <KpiCard
                    icon={
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M22.1425 2.90137C21.8701 2.61561 21.5467 2.38892 21.1908 2.23426C20.8348 2.0796 20.4533 2 20.0681 2C19.6828 2 19.3013 2.0796 18.9454 2.23426C18.5895 2.38892 18.2661 2.61561 17.9937 2.90137C17.7213 3.18707 17.5051 3.52627 17.3577 3.89959C17.2102 4.27291 17.1343 4.67304 17.1343 5.07712C17.1343 5.48121 17.2102 5.88134 17.3577 6.25466C17.5051 6.62798 17.7213 6.96718 17.9937 7.25288C18.0203 7.28076 18.0487 7.30768 18.0762 7.3346L15.6352 12.0899C14.891 11.8996 14.1053 12.0202 13.4444 12.4264L11.5946 10.4862C11.9585 9.84107 12.0854 9.07875 11.9513 8.34245C11.8172 7.60614 11.4315 6.9465 10.8665 6.48742C10.3015 6.02834 9.59619 5.8014 8.88296 5.84923C8.16973 5.89705 7.49768 6.21635 6.99304 6.74716C6.72059 7.03286 6.50447 7.37205 6.35701 7.74537C6.20956 8.11869 6.13367 8.51882 6.13367 8.92291C6.13367 9.327 6.20956 9.72713 6.35701 10.1004C6.50447 10.4738 6.72059 10.813 6.99304 11.0987C7.01962 11.1265 7.04712 11.1535 7.07462 11.1804L4.63359 15.9367C4.14361 15.8102 3.6308 15.8184 3.14474 15.9605C2.65867 16.1027 2.21579 16.374 1.8589 16.7481C1.44874 17.1784 1.16944 17.7266 1.05631 18.3234C0.943188 18.9202 1.00132 19.5388 1.22335 20.1009C1.44538 20.663 1.82134 21.1435 2.3037 21.4815C2.78606 21.8196 3.35315 22 3.93327 22C4.51339 22 5.08048 21.8196 5.56284 21.4815C6.0452 21.1435 6.42116 20.663 6.6432 20.1009C6.86523 19.5388 6.92335 18.9202 6.81023 18.3234C6.6971 17.7266 6.4178 17.1784 6.00764 16.7481C5.98106 16.7202 5.95264 16.6933 5.92515 16.6664L8.36618 11.9111C8.5957 11.97 8.83111 12.0001 9.06741 12.0005C9.59111 12.0012 10.1054 11.8548 10.557 11.5765L12.4068 13.5167C12.1283 14.0124 11.9879 14.5801 12.0016 15.1553C12.0153 15.7305 12.1825 16.2902 12.4842 16.7707C12.7859 17.2513 13.2101 17.6334 13.7085 17.8738C14.2069 18.1142 14.7596 18.2032 15.3038 18.1306C15.848 18.0581 16.3619 17.8269 16.7871 17.4634C17.2123 17.0999 17.5318 16.6186 17.7094 16.0742C17.8869 15.5298 17.9153 14.944 17.7914 14.3835C17.6675 13.823 17.3962 13.3102 17.0083 12.9033C16.9817 12.8754 16.9542 12.8485 16.9267 12.8216L19.3678 8.06626C19.5967 8.12481 19.8315 8.1545 20.0672 8.15471C20.6472 8.15462 21.2142 7.97416 21.6964 7.63615C22.1787 7.29814 22.5546 6.81775 22.7766 6.25571C22.9986 5.69367 23.0568 5.0752 22.9438 4.47849C22.8307 3.88178 22.5516 3.33362 22.1415 2.90329L22.1425 2.90137ZM4.97 20.0122C4.6948 20.3007 4.32159 20.4628 3.93249 20.4627C3.54338 20.4626 3.17025 20.3004 2.89517 20.0117C2.62009 19.7231 2.4656 19.3317 2.46569 18.9235C2.46577 18.5154 2.62043 18.124 2.89563 17.8355C3.03189 17.6927 3.19365 17.5793 3.37167 17.502C3.54968 17.4248 3.74047 17.385 3.93314 17.385C4.1258 17.3851 4.31657 17.4249 4.49456 17.5023C4.67254 17.5797 4.83425 17.6931 4.97046 17.836C5.10666 17.9789 5.21469 18.1486 5.28838 18.3353C5.36208 18.522 5.39998 18.7221 5.39994 18.9242C5.3999 19.1263 5.36191 19.3264 5.28814 19.5131C5.21437 19.6998 5.10626 19.8694 4.97 20.0122ZM8.02977 10.0132C7.89354 9.87034 7.78548 9.70074 7.71175 9.51408C7.63803 9.32742 7.60008 9.12736 7.60008 8.92531C7.60008 8.72327 7.63803 8.5232 7.71175 8.33654C7.78548 8.14988 7.89354 7.98029 8.02977 7.83744C8.23489 7.62233 8.49622 7.47586 8.78071 7.41653C9.0652 7.3572 9.36008 7.38769 9.62805 7.50413C9.89602 7.62057 10.1251 7.81774 10.2862 8.07071C10.4473 8.32367 10.5334 8.62108 10.5334 8.92531C10.5334 9.22955 10.4473 9.52695 10.2862 9.77992C10.1251 10.0329 9.89602 10.2301 9.62805 10.3465C9.36008 10.4629 9.0652 10.4934 8.78071 10.4341C8.49622 10.3748 8.23489 10.2283 8.02977 10.0132ZM15.9716 16.1664C15.6965 16.455 15.3234 16.6171 14.9344 16.6171C14.5454 16.6171 14.1723 16.455 13.8972 16.1664C13.6221 15.8779 13.4676 15.4866 13.4676 15.0786C13.4676 14.6705 13.6221 14.2792 13.8972 13.9907C14.1723 13.7022 14.5454 13.5401 14.9344 13.5401C15.3234 13.5401 15.6965 13.7022 15.9716 13.9907C16.2467 14.2792 16.4012 14.6705 16.4012 15.0786C16.4012 15.4866 16.2467 15.8779 15.9716 16.1664ZM21.1048 6.1674C20.8294 6.4558 20.456 6.61762 20.0668 6.61725C19.6776 6.61689 19.3045 6.45439 19.0295 6.16548C18.7546 5.87658 18.6003 5.48494 18.6006 5.07673C18.601 4.66851 18.7559 4.27716 19.0314 3.98877C19.1676 3.84591 19.3294 3.73259 19.5074 3.6553C19.6854 3.57801 19.8762 3.53825 20.0689 3.53829C20.2615 3.53834 20.4523 3.57819 20.6303 3.65556C20.8083 3.73294 20.97 3.84632 21.1062 3.98925C21.2424 4.13217 21.3504 4.30184 21.4241 4.48855C21.4978 4.67527 21.5357 4.87538 21.5357 5.07746C21.5356 5.27955 21.4976 5.47964 21.4239 5.66632C21.3501 5.853 21.242 6.02262 21.1057 6.16548L21.1048 6.1674Z"
                          fill="#FCFCFC"
                        />
                      </svg>
                    }
                    title="30D projected yield"
                    value={"$0.00"}
                  />
                </div>
              )}
              {/* When an action is open, show wallet panel up top on the left */}

              {/* Authenticated: positions tables */}
              {hasAnySupply && (
                <>
                  {/* Supply Positions */}
                  <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
                    {/* Card header */}
                    <div className="flex items-center justify-between p-5 border-b border-[#232322]">
                      <h2 className="text-lg font-semibold text-white">
                        Supply Positions
                      </h2>
                      <div className="flex gap-4 items-center">
                        <div className="text-sm font-medium text-white">
                          ${totalSupply.toFixed(4)}
                        </div>
                        <button
                          className="rounded-lg p-1 hover:bg-gray-100 transition cursor-pointer"
                          aria-label="collapse"
                          onClick={() => {
                            setshowSupplyPositions(!showSupplyPositions);
                          }}
                        >
                          {!showSupplyPositions ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    {showSupplyPositions && (
                      <div className="p-5">
                        {/* Header row */}
                        <div className="grid grid-cols-7 text-xs font-medium text-gray-400 px-3 pb-2">
                          <div className="">Assets</div>
                          <div className="text-right">Tokens</div>
                          <div className="text-right">Value</div>
                          <div className="text-right">Locked</div>
                          <div className="text-right">APR</div>
                          <div className="text-right"></div>
                          <div className="text-right"></div>
                        </div>

                        {/* Body rows */}
                        <div className="divide-y divide-[#232322]">
                          {marketRows.map((r, index: number) => (
                            <div
                              key={index}
                              className="grid grid-cols-7 items-center px-3 py-3 text-sm hover:bg-[#1F1F1F] transition"
                            >
                              {/* Asset / token */}
                              <div className="flex items-center gap-3">
                                {getTokenIcon(r.symbol as string) && (
                                  <Image
                                    src={
                                      getTokenIcon(r.symbol as string) as any
                                    }
                                    alt="logo"
                                    height={18}
                                    width={18}
                                  />
                                )}
                                <span className="font-medium text-white">
                                  {r.name}
                                </span>
                              </div>

                              {/* Amount */}
                              <div className="text-right text-gray-300">
                                {r.userSupplyUsd / 10 ** 9}
                              </div>

                              {/* Value */}
                              <div className="text-right text-gray-300">
                                $
                                {((r.userSupplyUsd / 10 ** 9) * livePricesBySymbol[r.name]).toFixed(4)}
                              </div>

                              {/* Locked */}
                              <div className="text-right text-gray-300">
                                ${((r.userSupplyUsd / 10 ** 9) * livePricesBySymbol[r.name]).toFixed(4)}
                              </div>

                              {/* APR */}
                              <div className="text-right text-gray-300">
                                {r.supplyAprPct
                                  ? `${r.supplyAprPct.toFixed(2)}%`
                                  : "0.00%"}
                              </div>

                              {/* Withdraw button */}
                              <div className="flex justify-end">
                                <Button
                                  className="bg-transparent text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                  onClick={() =>
                                    setActionPanel({
                                      type: "withdraw",
                                      asset: String(r.name),
                                      mintAddress: r.mintAddress,
                                    })
                                  }
                                >
                                  Withdraw
                                </Button>
                              </div>

                              {/* Supply button */}
                              <div className="flex justify-end">
                                <Button
                                  className="bg-[#0D0D0D] text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                  onClick={() =>
                                    setActionPanel({
                                      type: "supply",
                                      asset: String(r.name),
                                      mintAddress: r.mintAddress,
                                    })
                                  }
                                >
                                  Supply
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Debt Positions */}
                  <div className="rounded-2xl border border-[#232322] bg-transparent shadow-sm">
                    {/* Card header */}
                    <div className="flex items-center justify-between p-5 border-b border-[#232322]">
                      <h2 className="text-lg font-semibold text-white">
                        Debt Positions
                      </h2>
                      <div className="flex gap-4 items-center">
                        <div className="text-sm font-medium text-white">
                          ${merged.lendBorrow.total.toFixed(2)}
                        </div>
                        <button
                          className="rounded-lg p-1 hover:bg-gray-100 transition cursor-pointer"
                          aria-label="collapse"
                          onClick={() => {
                            setshowDebtPositions(!showDebtPositions);
                          }}
                        >
                          {!showDebtPositions ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    {showDebtPositions && (
                      <div className="p-5">
                        {/* Header row */}
                        <div className="grid grid-cols-8 text-xs font-medium text-gray-400 px-3 pb-2">
                          <div className="">Assets</div>
                          <div className="text-right">Value</div>
                          <div className="text-right"></div> {/* Repay */}
                          <div className="text-right"></div> {/* Spend */}
                          <div className="text-right">APR</div>
                          <div className="text-right">Collateral</div>
                          <div className="text-right">Health</div>
                          <div className="text-right"></div> {/* Add Col. */}
                        </div>

                        <div className="divide-y divide-[#232322]">
                          {merged.lendBorrow.rows.map(
                            (
                              r: {
                                market: React.ReactNode;
                                assets: number; // treating this as "Value" here
                                debt: number;
                                apr?: number;
                                collateral?: string;
                                health?: number;
                              },
                              index: number
                            ) => (
                              <div
                                key={index}
                                className="grid grid-cols-8 items-center px-3 py-3 text-sm hover:bg-[#1F1F1F] transition"
                              >
                                {/* Assets */}
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-1 ring-emerald-400" />
                                  <span className="font-medium text-white">
                                    {r.market}
                                  </span>
                                </div>

                                {/* Value */}
                                <div className="text-right text-gray-300">
                                  ${r.assets.toFixed(2)}
                                </div>

                                {/* Repay button */}
                                <div className="flex justify-end">
                                  <Button
                                    className="bg-transparent text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                    onClick={() =>
                                      setActionPanel({
                                        type: "repay",
                                        asset: String(r.market),
                                        mintAddress: "",
                                      })
                                    }
                                  >
                                    Repay
                                  </Button>
                                </div>

                                {/* Spend button */}
                                <div className="flex justify-end">
                                  <Button
                                    className="bg-[#0D0D0D] text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                    onClick={() =>
                                      setActionPanel({
                                        type: "spend",
                                        asset: String(r.market),
                                        mintAddress: "",
                                      })
                                    }
                                  >
                                    Spend
                                  </Button>
                                </div>

                                {/* APR */}
                                <div className="text-right text-gray-300">
                                  {r.apr ? `${r.apr.toFixed(2)}%` : "0.00%"}
                                </div>

                                {/* Collateral */}
                                <div className="text-right text-gray-300 flex items-center justify-end gap-2">
                                  <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-1 ring-emerald-400" />
                                  <span className="font-medium text-white">
                                    {r.collateral ?? r.market}
                                  </span>
                                </div>

                                {/* Health */}
                                <div className="text-right text-gray-300">
                                  {r.health
                                    ? `${r.health.toFixed(2)}%`
                                    : "0.00%"}
                                </div>

                                {/* Add Col. button */}
                                <div className="flex justify-end">
                                  <Button
                                    className="bg-[#0D0D0D] text-white cursor-pointer border border-[#222222] h-8 px-3 text-xs font-medium"
                                    onClick={() =>
                                      setActionPanel({
                                        type: "addCollateral",
                                        asset: String(r.market),
                                        mintAddress: "",
                                      })
                                    }
                                  >
                                    Add Col.
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Unauthenticated: marketing cards */}
              {!hasAnySupply && (
                <>
                  <div className="rounded-2xl flex items-center p-2 justify-between border border-[#232322] bg-transparent shadow-sm">
                    <div className="p-5">
                      <h2 className="text-lg font-semibold text-white">
                        Lend & Borrow
                      </h2>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-2">
                        No open positions yet
                      </p>
                      <p className="text-sm text-gray-300 mt-1 max-w-[300px]">
                        Boost your earnings by lending and borrowing against
                        your collateral
                      </p>

                      <div className="mt-6 flex w-full items-start justify-between">
                        <div className="flex md:justify-end">
                          <button className="rounded-md bg-[#FECD6D] hover:bg-[#fece6dd5] text-black cursor-pointer  px-5 py-2.5 text-sm font-semibold shadow  transition">
                            Deposit now
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Image
                        src={lendingIcon || "/placeholder.svg"}
                        alt="Pool"
                        objectFit="contain"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl flex items-center p-2 justify-between border border-[#232322] bg-transparent shadow-sm">
                    <div className="p-5">
                      <h2 className="text-lg font-semibold text-white">
                        Pools
                      </h2>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-2">
                        No open deposit yet
                      </p>
                      <p className="text-sm text-gray-300 mt-1 max-w-[300px]">
                        Deposit crypto into liquidity pools to earn swap fees
                        and yield
                      </p>

                      <div className="mt-6 flex w-full items-start justify-between">
                        <div className="flex md:justify-end">
                          <button className="rounded-md bg-[#FECD6D] hover:bg-[#fece6dd5] text-black cursor-pointer px-5 py-2.5 text-sm font-semibold shadow  transition">
                            Deposit now
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Image
                        src={depositPoolIcon || "/placeholder.svg"}
                        alt="Pool"
                        objectFit="contain"
                      />
                    </div>
                  </div>
                </>
              )}
              {actionPanel && (
                <div className="space-y-6">
                  <DevnetWalletPanel solValue={sol} usdcValue={usdc} usdtValue={usdt} />
                </div>
              )}
            </div>
          }

          {/* RIGHT SIDE */}
          <div className="w-[35%] space-y-6 transition-all">
            {/* Default: wallet on right */}
            {!actionPanel && <DevnetWalletPanel solValue={sol} usdcValue={usdc} usdtValue={usdt} />}

            {/* Action mode: show the action drawer */}
            {actionPanel && (
              <ActionPanel
                actionPanel={actionPanel}
                onClose={() => setActionPanel(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

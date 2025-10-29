import { useEffect, useRef, useState, useCallback } from "react";
import { SpendContent } from "./SpendContent";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import { fetchSplTokenBalance, getConnection } from "@/utils/chain/solana";
import {
  buildBorrowTx,
  buildDepositTx,
  buildWithdrawTx,
  fetchUserPositionViewRawWeb3,
} from "@/utils/chain/helper";
import { Button } from "@/components/ui/button";
import { getTokenIcon } from "@/utils/helper";
import Image from "next/image";
import { ChevronDownIcon } from "lucide-react";

export function ActionPanel({
  actionPanel,
  onClose,
}: {
  actionPanel: { type: string; asset: string; mintAddress: string };
  onClose: () => void;
}) {
  const prettyTitleMap: Record<string, string> = {
    supply: "Supply",
    withdraw: "Withdraw",
    repay: "Repay debt",
    spend: "Spend",
    addCollateral: "Add collateral",
    borrow: "Borrow",
  };

  const heading = prettyTitleMap[actionPanel.type] || "Action";
  const isSpend = actionPanel.type === "spend";

  // ===== Collateral / Supply slider state =====
  const [healthPct, setHealthPct] = useState(0); // % for collateral "Amount"
  const [amount, setAmount] = useState<number>(0); // collateral or withdraw amount

  // ===== Borrow slider state =====
  const [borrowPct, setBorrowPct] = useState(0); // % for "Borrow Amount"
  const [borrowAmount, setBorrowAmount] = useState<number>(0); // how much to borrow

  // Wallet balance in token units
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const [balance, setBalance] = useState<number | null>(null);
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [txSig, setTxSig] = useState("");

  // we now keep two independent slider refs / dragging refs
  const collateralDraggingRef = useRef(false);
  const borrowDraggingRef = useRef(false);
  const collateralSliderRef = useRef<HTMLDivElement | null>(null);
  const borrowSliderRef = useRef<HTMLDivElement | null>(null);
  const marketOptions = ["USDC", "USDT", "SOL"];
  const [activeTab, setActiveTab] = useState<"liquidity" | "swap">("liquidity");
  const [selectedDapp, setSelectedDapp] = useState<string>("Select Dapp");
  const [selectedMarket, setSelectedMarket] = useState<string>("USDC");
  const [selectedBorrowMarket, setSelectedBorrowMarket] =
    useState<string>("USDC");
  const [showMarketMenu, setShowMarketMenu] = useState(false);
  const marketRef = useRef<HTMLDivElement | null>(null);
  const canDeposit = !!pubkey && amount !== 0 && Number(amount) > 0 && !busy;

  // ---------- TX HANDLERS (unchanged) ----------
  const onApproveAndDeposit = async () => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet) || !pubkey) {
      setShowAuthFlow(true);
      return;
    }

    setBusy(true);
    setTxSig("");

    try {
      const value = Number(amount);
      if (value <= 0) throw new Error("Enter valid amount");

      const connection = getConnection();

      const { ix } = await buildDepositTx({
        owner: pubkey,
        mint: new PublicKey(actionPanel.mintAddress),
        amountUi: value,
        mintDecimals: 9,
        connection: connection as any,
      });

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        const rawTx = signedTx.serialize();
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        setBalance(
          await fetchSplTokenBalance(
            pubkey,
            new PublicKey(actionPanel.mintAddress)
          )
        );
      } catch (sendErr: any) {
        if (sendErr instanceof SendTransactionError) {
        }
        throw sendErr;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onApproveAndWithdraw = async () => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet) || !pubkey) {
      setShowAuthFlow(true);
      return;
    }

    setBusy(true);
    setTxSig("");

    try {
      const value = Number(amount);
      if (value <= 0) throw new Error("Enter valid amount");

      const connection = getConnection();

      const { ix } = await buildWithdrawTx({
        owner: pubkey,
        mint: new PublicKey(actionPanel.mintAddress),
        sharesUi: value,
        shareDecimals: 9,
      });

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        const rawTx = signedTx.serialize();
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: freshTx.recentBlockhash!,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        setBalance(
          await fetchSplTokenBalance(
            pubkey,
            new PublicKey(actionPanel.mintAddress)
          )
        );
      } catch (sendErr: any) {
        if (sendErr instanceof SendTransactionError) {

        }
        throw sendErr;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

// app config you MUST fill with real addresses from your bootstrap script
const PROTOCOL_ASSETS = {
  COLLATERAL: {
    mint: "REPLACE_WITH_mockMint1_base58",
    decimals: 9,
  },
  BORROW: {
    mint: "REPLACE_WITH_mockMint2_base58",
    decimals: 6,
  },
};


const onBorrow = async () => {
  if (!primaryWallet || !isSolanaWallet(primaryWallet) || !pubkey) {
    setShowAuthFlow(true);
    return;
  }
  alert('hi')


  setBusy(true);
  setTxSig("");

  try {
    const collateralVal = Number(amount);
    const borrowVal = Number(borrowAmount);

    if (collateralVal <= 0) throw new Error("Enter valid collateral");
    // if (borrowVal <= 0) throw new Error("Enter valid borrow amount");

    const connection = getConnection();

    // 2. pick the two assets (must match how your protocol was initialized)
    const collateralCfg = PROTOCOL_ASSETS.COLLATERAL;
    const borrowCfg     = PROTOCOL_ASSETS.BORROW;

    const collateralMintPk = new PublicKey(collateralCfg.mint);
    const borrowMintPk     = new PublicKey(borrowCfg.mint);

    // 3. build your program instruction
    const { ix } = await buildBorrowTx({
      borrower: pubkey,
      collateralMint: collateralMintPk,
      borrowMint: borrowMintPk,
      sharesAmountUi: collateralVal,
      borrowAmountUi: borrowVal,
      collateralMintDecimals: collateralCfg.decimals,
      borrowMintDecimals: borrowCfg.decimals,
      priceUpdateCollateral: new PublicKey(''),
      priceUpdateBorrow: new PublicKey(''),
      connection: connection as any,
    });

    // 4. standard tx build / sign / send
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");

    const freshTx = new Transaction();
    freshTx.add(ix);
    freshTx.feePayer = pubkey;
    freshTx.recentBlockhash = blockhash;
    (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

    const signer = await primaryWallet.getSigner();
    const signedTx = await signer.signTransaction(freshTx as any);

    try {
      const rawTx = signedTx.serialize();
      const sig = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      setTxSig(sig);
    } catch (sendErr: any) {
      throw sendErr;
    }
  } catch (err) {
    console.error(err);
  } finally {
    setBusy(false);
  }
};




  // ---------- wallet / balances ----------
  useEffect(() => {
    if (
      primaryWallet &&
      isSolanaWallet(primaryWallet) &&
      primaryWallet.address
    ) {
      try {
        setPubkey(new PublicKey(primaryWallet.address));
      } catch {
        setPubkey(null);
      }
    } else {
      setPubkey(null);
    }
  }, [primaryWallet]);

  useEffect(() => {
    (async () => {
      if (!pubkey) {
        setWalletBalance(0);
        setAmount(0);
        setHealthPct(0);
        setBorrowAmount(0);
        setBorrowPct(0);
        return;
      }
      try {
        const bal = await fetchSplTokenBalance(
          pubkey,
          new PublicKey(actionPanel.mintAddress)
        );
        setWalletBalance(bal);

        // keep collateral amount clamped
        setAmount((prev) => {
          const clamped = Math.min(Math.max(prev, 0), bal || 0);
          const pct = bal > 0 ? (clamped / bal) * 100 : 0;
          setHealthPct(pct);
          return clamped;
        });

        // keep borrow amount clamped
        setBorrowAmount((prev) => {
          const clamped = Math.min(Math.max(prev, 0), bal || 0);
          const pct = bal > 0 ? (clamped / bal) * 100 : 0;
          setBorrowPct(pct);
          return clamped;
        });
      } catch {
        setWalletBalance(0);
        setAmount(0);
        setHealthPct(0);
        setBorrowAmount(0);
        setBorrowPct(0);
      }
    })();
  }, [pubkey, primaryWallet, actionPanel.mintAddress]);

  useEffect(() => {
    (async () => {
      if (!pubkey) return;
      const connection = getConnection();

      const view = await fetchUserPositionViewRawWeb3({
        owner: pubkey,
        marketMint: new PublicKey(actionPanel.mintAddress),
        connection,
        commitment: "confirmed",
      });

      if (view) {
        setBalance(Number(view.depositedSharesUi) / 10 ** 9);
      }
    })();
  }, [pubkey, actionPanel.mintAddress]);

  // ---------- helpers: collateral slider <-> amount ----------
  const updateFromPct = useCallback(
    (pctRaw: number) => {
      const pct = Math.max(0, Math.min(100, pctRaw));
      setHealthPct(pct);

      if (walletBalance > 0) {
        const nextAmount = (walletBalance * pct) / 100;
        setAmount(nextAmount);
      } else {
        setAmount(0);
      }
    },
    [walletBalance]
  );

  const updateFromAmount = useCallback(
    (amtRaw: number) => {
      const amt = Math.max(
        0,
        Math.min(isFinite(amtRaw) ? amtRaw : 0, walletBalance || 0)
      );

      setAmount(amt);

      const pct = walletBalance > 0 ? (amt / walletBalance) * 100 : 0;
      setHealthPct(pct);
    },
    [walletBalance]
  );

  // ---------- helpers: borrow slider <-> borrowAmount ----------
  const updateFromBorrowPct = useCallback(
    (pctRaw: number) => {
      const pct = Math.max(0, Math.min(100, pctRaw));
      setBorrowPct(pct);

      if (walletBalance > 0) {
        const nextAmount = (walletBalance * pct) / 100;
        setBorrowAmount(nextAmount);
      } else {
        setBorrowAmount(0);
      }
    },
    [walletBalance]
  );

  const updateFromBorrowAmount = useCallback(
    (amtRaw: number) => {
      const amt = Math.max(
        0,
        Math.min(isFinite(amtRaw) ? amtRaw : 0, walletBalance || 0)
      );

      setBorrowAmount(amt);

      const pct = walletBalance > 0 ? (amt / walletBalance) * 100 : 0;
      setBorrowPct(pct);
    },
    [walletBalance]
  );

  // ---------- slider math (separate for each slider) ----------

  function positionToPctForCollateral(clientX: number) {
    if (!collateralSliderRef.current) return;
    const rect = collateralSliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    updateFromPct(pct);
  }

  function positionToPctForBorrow(clientX: number) {
    if (!borrowSliderRef.current) return;
    const rect = borrowSliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    updateFromBorrowPct(pct);
  }

  function handleCollateralMouseDown(e: React.MouseEvent) {
    collateralDraggingRef.current = true;
    positionToPctForCollateral(e.clientX);

    window.addEventListener("mousemove", handleCollateralMouseMove);
    window.addEventListener("mouseup", handleCollateralMouseUp);
  }

  function handleCollateralMouseMove(e: MouseEvent) {
    if (!collateralDraggingRef.current) return;
    positionToPctForCollateral(e.clientX);
  }

  function handleCollateralMouseUp() {
    collateralDraggingRef.current = false;
    window.removeEventListener("mousemove", handleCollateralMouseMove);
    window.removeEventListener("mouseup", handleCollateralMouseUp);
  }

  function handleCollateralTouchStart(e: React.TouchEvent) {
    collateralDraggingRef.current = true;
    positionToPctForCollateral(e.touches[0].clientX);

    window.addEventListener("touchmove", handleCollateralTouchMove);
    window.addEventListener("touchend", handleCollateralTouchEnd);
  }

  function handleCollateralTouchMove(e: TouchEvent) {
    if (!collateralDraggingRef.current) return;
    positionToPctForCollateral(e.touches[0].clientX);
  }

  function handleCollateralTouchEnd() {
    collateralDraggingRef.current = false;
    window.removeEventListener("touchmove", handleCollateralTouchMove);
    window.removeEventListener("touchend", handleCollateralTouchEnd);
  }

  function handleBorrowMouseDown(e: React.MouseEvent) {
    borrowDraggingRef.current = true;
    positionToPctForBorrow(e.clientX);

    window.addEventListener("mousemove", handleBorrowMouseMove);
    window.addEventListener("mouseup", handleBorrowMouseUp);
  }

  function handleBorrowMouseMove(e: MouseEvent) {
    if (!borrowDraggingRef.current) return;
    positionToPctForBorrow(e.clientX);
  }

  function handleBorrowMouseUp() {
    borrowDraggingRef.current = false;
    window.removeEventListener("mousemove", handleBorrowMouseMove);
    window.removeEventListener("mouseup", handleBorrowMouseUp);
  }

  function handleBorrowTouchStart(e: React.TouchEvent) {
    borrowDraggingRef.current = true;
    positionToPctForBorrow(e.touches[0].clientX);

    window.addEventListener("touchmove", handleBorrowTouchMove);
    window.addEventListener("touchend", handleBorrowTouchEnd);
  }

  function handleBorrowTouchMove(e: TouchEvent) {
    if (!borrowDraggingRef.current) return;
    positionToPctForBorrow(e.touches[0].clientX);
  }

  function handleBorrowTouchEnd() {
    borrowDraggingRef.current = false;
    window.removeEventListener("touchmove", handleBorrowTouchMove);
    window.removeEventListener("touchend", handleBorrowTouchEnd);
  }

  // derived values for "health" box (placeholder logic)
  const currentHealth = 1.87;
  const projectedHealth = (1.5 + (healthPct / 100) * 1.0).toFixed(2);

  return (
    <div className="rounded-2xl border border-[#232322] shadow-sm text-white">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[#2a2a2a]">
        <div>
          <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
            {heading}
          </div>
          <div className="text-lg font-semibold text-white flex items-center gap-2">
            {heading} {actionPanel.asset}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Supplied balance: {balance} {actionPanel.asset}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-white border border-[#2a2a2a] rounded-md px-2 py-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-2 space-y-5 text-sm">
        {isSpend && (
          <SpendContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedDapp={selectedDapp}
            setSelectedDapp={setSelectedDapp}
            selectedMarket={selectedMarket}
            setSelectedMarket={setSelectedMarket}
          />
        )}

        {/* Input/Sliders (hide if swap tab in Spend) */}
        {!(activeTab === "swap" && isSpend) && (
          <>
            {/* Collateral / Amount */}
            <div className="space-y-2 border border-[#27272A] rounded-md p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-gray-400 text-[12px]">
                  <span>Amount</span>
                  <button
                    className="text-black bg-[#FECD6D] py-1 px-2 rounded-md cursor-pointer"
                    onClick={() => {
                      updateFromPct(100);
                    }}
                  >
                    MAX
                  </button>
                </div>

                <div className="bg-[#0D0D0D] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-baseline justify-between">
                  <input
                    className="bg-transparent outline-none text-white text-lg w-full"
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      updateFromAmount(Number(e.target.value));
                    }}
                    placeholder="0.00"
                  />
                  <span className="text-gray-500 text-xs ml-2">
                    {actionPanel.asset}
                  </span>
                </div>

                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>$123.45</span>
                  <span className="text-[#8D8D8C] flex gap-1">
                    Wallet Balance:{" "}
                    <span className="text-white">
                      {walletBalance} {actionPanel.asset}
                    </span>
                  </span>
                </div>
              </div>

              {/* Collateral Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-gray-400 text-[12px]">
                  <span>Amount ({healthPct.toFixed(0)}%)</span>
                  <span className="text-gray-500">
                    {amount.toFixed(4)} {actionPanel.asset}
                  </span>
                </div>

                <div
                  ref={collateralSliderRef}
                  className="h-2 rounded-full bg-[#2a2a2a] relative cursor-pointer select-none"
                  onMouseDown={handleCollateralMouseDown}
                  onTouchStart={handleCollateralTouchStart}
                >
                  <div
                    className="absolute h-2 rounded-full bg-[#FFCD6D]"
                    style={{ width: `${healthPct}%` }}
                  />
                  <div
                    className="absolute -top-[4px] h-4 w-4 flex items-center justify-center"
                    style={{
                      left: `calc(${healthPct}% - 8px)`,
                    }}
                  >
                    <ThumbIcon />
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Borrow box */}
            {actionPanel.type === "borrow" && (
              <div className="space-y-2 border border-[#27272A] rounded-md p-4">
                <div
                  className="rounded-xl border border-[#2a2a2a] bg-[#1A1A1A] p-4 text-left w-full relative"
                  ref={marketRef}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* token icon */}
                      {getTokenIcon(selectedBorrowMarket as string) && (
                        <Image
                          src={
                            getTokenIcon(selectedBorrowMarket as string) as any
                          }
                          alt="logo"
                          height={34}
                          width={34}
                        />
                      )}
                      <div>
                        <div className="text-[14px] text-gray-400 font-medium">
                          Select Borrow market
                        </div>
                        <div className="text-[16px] text-gray-300 font-semibold leading-tight flex items-center gap-2">
                          {selectedBorrowMarket}
                        </div>
                      </div>
                    </div>

                    <button
                      className="border border-[#2a2a2a] bg-transparent rounded-md h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition"
                      onClick={() => {
                        // toggle this dropdown, close the other
                        setShowMarketMenu((open) => !open);
                      }}
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 text-white transition-transform ${
                          showMarketMenu ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* dropdown menu for market */}
                  {showMarketMenu && (
                    <div className="absolute left-0 top-full mt-2 w-full rounded-lg border border-[#2a2a2a] bg-[#1E1F1E] shadow-xl z-50 overflow-hidden">
                      {marketOptions.map((opt: string) => (
                        <button
                          key={opt}
                          className={`w-full text-left px-4 py-3 text-[13px] cursor-pointer flex justify-between items-center hover:bg-[#2a2a2a] ${
                            selectedMarket === opt
                              ? "text-white font-semibold"
                              : "text-gray-300"
                          }`}
                          onClick={() => {
                            setSelectedBorrowMarket(opt);
                            setShowMarketMenu(false);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {/* token circle */}
                            {getTokenIcon(opt as string) && (
                              <Image
                                src={getTokenIcon(opt as string) as any}
                                alt="logo"
                                height={18}
                                width={18}
                              />
                            )}
                            <span>{opt}</span>
                          </span>

                          {selectedMarket === opt && (
                            <span className="text-[11px] text-emerald-400 font-medium">
                              active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-gray-400 text-[12px]">
                    <span>Borrow Amount</span>
                    <button
                      className="text-black bg-[#FECD6D] py-1 px-2 rounded-md cursor-pointer"
                      onClick={() => {
                        updateFromBorrowPct(100);
                      }}
                    >
                      MAX
                    </button>
                  </div>

                  <div className="bg-[#0D0D0D] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-baseline justify-between">
                    <input
                      className="bg-transparent outline-none text-white text-lg w-full"
                      type="number"
                      value={borrowAmount}
                      onChange={(e) => {
                        updateFromBorrowAmount(Number(e.target.value));
                      }}
                      placeholder="0.00"
                    />
                    <span className="text-gray-500 text-xs ml-2">
                      {actionPanel.asset}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-500 flex justify-between">
                    <span>$123.45</span>
                    <span className="text-[#8D8D8C] flex gap-1">
                      Available Balance:{" "}
                      <span className="text-white">
                        {walletBalance} {actionPanel.asset}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Borrow Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400 text-[12px]">
                    <span>Borrow Amount ({borrowPct.toFixed(0)}%)</span>
                    <span className="text-gray-500">
                      {borrowAmount.toFixed(4)} {actionPanel.asset}
                    </span>
                  </div>

                  <div
                    ref={borrowSliderRef}
                    className="h-2 rounded-full bg-[#2a2a2a] relative cursor-pointer select-none"
                    onMouseDown={handleBorrowMouseDown}
                    onTouchStart={handleBorrowTouchStart}
                  >
                    <div
                      className="absolute h-2 rounded-full bg-[#FFCD6D]"
                      style={{ width: `${borrowPct}%` }}
                    />
                    <div
                      className="absolute -top-[4px] h-4 w-4 flex items-center justify-center"
                      style={{
                        left: `calc(${borrowPct}% - 8px)`,
                      }}
                    >
                      <ThumbIcon />
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Breakdown */}
        {!(activeTab === "swap" && isSpend) && (
          <div className="rounded-xl border border-[#27272A] p-4 space-y-3 text-[12px]">
            <Row label="Borrow amount" value="$0.00" />
            <Row label="Min collateral allowed" value="$12.97" />
            <Row label="Est. collateral value" value="$58.97" />
            <Row label="Fees" value="$0.01" />
            <Row label="Gas estimate" value="$0.01" />
          </div>
        )}

        {/* CTA */}
        <Button
          className="w-full rounded-md bg-[#FECD6D] text-black hover:bg-[#fece6dd5] font-semibold text-sm py-3 transition cursor-pointer"
          onClick={() => {
            if (heading === "Supply") {
              onApproveAndDeposit();
            } else if (heading === "Withdraw") {
              onApproveAndWithdraw();
            } else if (heading === "Borrow") {
              onBorrow();
            }
          }}
          disabled={!canDeposit && heading !== "Borrow"}
        >
          {busy ? "Processing..." : heading}
        </Button>

        <div className="text-[11px] text-gray-500 text-center">
          Powered by OwlFi
        </div>
      </div>
    </div>
  );
}

function ThumbIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="#181818"
        stroke="#FFCC6C"
        strokeWidth="4"
      />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

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

  // % of walletBalance (0-100)
  const [healthPct, setHealthPct] = useState(0);

  // wallet token balance (in UI units of this asset)
  const [walletBalance, setwalletBalance] = useState<number>(0);

  // amount user is going to act on (same unit as walletBalance)
  const [amount, setamount] = useState<number>(0);

  const [balance, setBalance] = useState<number | null>(null);
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [txSig, setTxSig] = useState("");
  const draggingRef = useRef(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<"liquidity" | "swap">("liquidity");
  const [selectedDapp, setSelectedDapp] = useState<string>("Select Dapp");
  const [selectedMarket, setSelectedMarket] = useState<string>("USDC");
  const canDeposit = !!pubkey && amount !== 0 && Number(amount) > 0 && !busy;

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

      // 1. get instruction + PDAs (no blockhash yet)
      const { ix } = await buildDepositTx({
        owner: pubkey,
        mint: new PublicKey(actionPanel.mintAddress),
        amountUi: value,
        mintDecimals: 9,
        connection: connection as any,
      });

      // 2. create a brand new transaction using a FRESH blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized"); // "processed" also fine, "finalized" more stable

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      // stash lastValidBlockHeight so we can confirm later
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      // 4. sign and send the SAME freshTx
      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        const rawTx = signedTx.serialize();
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        // await connection.confirmTransaction(
        //   {
        //     signature: sig,
        //     blockhash: freshTx.recentBlockhash!,
        //     lastValidBlockHeight,
        //   },
        //   "confirmed"
        // );

        setBalance(
          await fetchSplTokenBalance(
            pubkey,
            new PublicKey(actionPanel.mintAddress)
          )
        );
      } catch (sendErr: any) {
        // if it's a SendTransactionError, pull logs
        if (sendErr instanceof SendTransactionError) {
          const logs = await sendErr.getLogs(connection);
          console.error("SendTransactionError logs:", logs);
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
      // 1. parse user input
      const value = Number(amount); // the "amount to withdraw" field in your UI
      if (value <= 0) throw new Error("Enter valid amount");

      const connection = getConnection();

      // 2. build withdraw instruction (no blockhash yet!)
      const { ix } = await buildWithdrawTx({
        owner: pubkey,
        mint: new PublicKey(actionPanel.mintAddress),
        sharesUi: value,
        shareDecimals: 9, // <-- IMPORTANT: this is SHARES decimals, not underlying mint decimals
      });

      // 3. get a FRESH blockhash and assemble the transaction we will actually send
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      // 4. simulate THIS tx before prompting wallet

      // 5. request wallet signature
      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        // 6. broadcast
        const rawTx = signedTx.serialize();
        console.log(rawTx, "tx");
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        // 7. confirm
        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: freshTx.recentBlockhash!,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        // 8. refresh balances
        setBalance(
          await fetchSplTokenBalance(
            pubkey,
            new PublicKey(actionPanel.mintAddress)
          )
        );
      } catch (sendErr: any) {
        if (sendErr instanceof SendTransactionError) {
          const logs = await sendErr.getLogs(connection);
          console.error("SendTransactionError logs (withdraw):", logs);
        }
        throw sendErr;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // ---------------- wallet/pubkey setup ----------------
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

  // fetch wallet balance for this mint
  useEffect(() => {
    (async () => {
      if (!pubkey) {
        setwalletBalance(0);
        // reset derived UI if no wallet
        setamount(0);
        setHealthPct(0);
        return;
      }
      try {
        const bal = await fetchSplTokenBalance(
          pubkey,
          new PublicKey(actionPanel.mintAddress)
        );
        setwalletBalance(bal);

        // when walletBalance changes, keep amount clamped
        setamount((prev) => {
          const clampedAmount = Math.min(Math.max(prev, 0), bal || 0);
          // also sync % to new balance
          const pct = bal > 0 ? (clampedAmount / bal) * 100 : 0;
          setHealthPct(pct);
          return clampedAmount;
        });
      } catch {
        setwalletBalance(0);
        setamount(0);
        setHealthPct(0);
      }
    })();
  }, [pubkey, primaryWallet, actionPanel.mintAddress]);

  // fetch supplied balance / position view
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

  // ---------------- helpers to sync amount <-> pct ----------------

  // set slider pct and derive amount from it
  const updateFromPct = useCallback(
    (pctRaw: number) => {
      // clamp 0..100
      const pct = Math.max(0, Math.min(100, pctRaw));

      setHealthPct(pct);

      // derive new amount from pct
      if (walletBalance > 0) {
        const nextAmount = (walletBalance * pct) / 100;
        setamount(nextAmount);
      } else {
        // no balance -> always 0
        setamount(0);
      }
    },
    [walletBalance]
  );

  // set typed amount and derive pct from it
  const updateFromAmount = useCallback(
    (amtRaw: number) => {
      // clamp 0..walletBalance
      const amt = Math.max(
        0,
        Math.min(isFinite(amtRaw) ? amtRaw : 0, walletBalance || 0)
      );

      setamount(amt);

      const pct = walletBalance > 0 ? (amt / walletBalance) * 100 : 0;
      setHealthPct(pct);
    },
    [walletBalance]
  );

  // ---------------- slider position math ----------------
  function positionToPct(clientX: number) {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    updateFromPct(pct);
  }

  // mouse handlers
  function handleMouseDown(e: React.MouseEvent) {
    draggingRef.current = true;
    positionToPct(e.clientX);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!draggingRef.current) return;
    positionToPct(e.clientX);
  }

  function handleMouseUp() {
    draggingRef.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  // touch handlers
  function handleTouchStart(e: React.TouchEvent) {
    draggingRef.current = true;
    positionToPct(e.touches[0].clientX);

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!draggingRef.current) return;
    positionToPct(e.touches[0].clientX);
  }

  function handleTouchEnd() {
    draggingRef.current = false;
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
  }

  // derived values for "health" box (placeholder logic)
  const currentHealth = 1.87;
  const projectedHealth = (1.5 + (healthPct / 100) * 1.0).toFixed(2);

  return (
    <div className="rounded-2xl border border-[#232322] bg-[#1E1F1E] shadow-sm text-white">
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

        {/* Amount + Slider (hide if swap tab in Spend) */}
        {!(activeTab === "swap" && isSpend) && (
          <div className="space-y-2 border border-[#27272A] rounded-md p-4">
            {/* Amount input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-gray-400 text-[12px]">
                <span>Amount</span>
                <button
                  className="text-black bg-[#FECD6D] py-1 px-2 rounded-md cursor-pointer"
                  onClick={() => {
                    // MAX → 100%
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

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-gray-400 text-[12px]">
                <span>Amount ({healthPct.toFixed(0)}%)</span>
                <span className="text-gray-500">
                  {amount.toFixed(4)} {actionPanel.asset}
                </span>
              </div>

              {/* Slider wrapper */}
              <div
                ref={sliderRef}
                className="h-2 rounded-full bg-[#2a2a2a] relative cursor-pointer select-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                {/* filled track */}
                <div
                  className="absolute h-2 rounded-full bg-[#FFCD6D]"
                  style={{ width: `${healthPct}%` }}
                />

                {/* thumb */}
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
        )}

        {/* Breakdown box */}
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
            }
          }}
          disabled={!canDeposit}
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

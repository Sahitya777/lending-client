
/* ------------------ Action Panel ------------------ */

import { useRef, useState } from "react";
import { SpendContent } from "./SpendContent";

export function ActionPanel({
  actionPanel,
  onClose,
}: {
  actionPanel: { type: string; asset: string };
  onClose: () => void;
}) {
  const prettyTitleMap: Record<string, string> = {
    supply: "Supply",
    withdraw: "Withdraw",
    repay: "Repay debt",
    spend: "Spend",
    addCollateral: "Add collateral",
  };

  const heading = prettyTitleMap[actionPanel.type] || "Action";
  const isSpend = actionPanel.type === "spend";
  // slider percent (0-100)
  const [healthPct, setHealthPct] = useState(70); // start at 70%
  const [walletBalance, setwalletBalance] = useState<number>(12);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [amount, setamount] = useState<number>(0);
  const draggingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"liquidity" | "swap">("liquidity");

  // fake selections
  const [selectedDapp, setSelectedDapp] = useState<string>("Select Dapp");
  const [selectedMarket, setSelectedMarket] = useState<string>("USDC");

  // helper: convert click/drag position to % and clamp 0-100
  function positionToPct(clientX: number) {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    setHealthPct(clamped);
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

  // touch handlers (mobile)
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

  // derived values (example math; swap with real health calc)
  const currentHealth = 1.87;
  const projectedHealth = (1.5 + (healthPct / 100) * 1.0).toFixed(2); // fake formula just to show movement

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
            Wallet balance: 12.345 {actionPanel.asset}
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
        {/* Amount input */}
        {!(activeTab === "swap" && isSpend) && (
          <div className="space-y-2 border border-[#27272A] rounded-md p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-gray-400 text-[12px]">
                <span>Amount</span>
                <button
                  className="text-black  bg-[#FECD6D] py-1 px-2 rounded-md cursor-pointer"
                  onClick={() => {
                    setamount(walletBalance);
                  }}
                >
                  MAX
                </button>
              </div>
              <div className="bg-[#0D0D0D] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-baseline justify-between">
                <input
                  className="bg-transparent outline-none text-white text-lg w-full"
                  type="number"
                  value={amount ? amount : ""}
                  onChange={(e) => {
                    setamount(Number(e.target.value));
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

            {/* Health / Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-gray-400 text-[12px]">
                <span>Amount</span>
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
                    left: `calc(${healthPct}% - 8px)`, // center the 16px thumb
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
          <div className="rounded-xl  border border-[#27272A] p-4 space-y-3 text-[12px]">
            <Row label="Borrow amount" value="$0.00" />
            <Row label="Min collateral allowed" value="$12.97" />
            <Row label="Est. collateral value" value="$58.97" />
            <Row label="Fees" value="$0.01" />
            <Row label="Gas estimate" value="$0.01" />
          </div>
        )}

        {/* CTA */}
        <button className="w-full rounded-xl bg-[#FECD6D] text-black hover:bg-[#fece6dd5] font-semibold text-sm py-3  transition cursor-pointer">
          {heading}
        </button>

        <div className="text-[11px] text-gray-500 text-center">
          Powered by OwlFi
        </div>
      </div>
    </div>
  );
}

/**
 * Yellow ring thumb icon:
 * <circle cx="8" cy="8" r="6" fill="#181818" stroke="#FFCC6C" strokeWidth="4" />
 */
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
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

export function SpendContent({
  activeTab,
  setActiveTab,
  selectedDapp,
  setSelectedDapp,
  selectedMarket,
  setSelectedMarket,
}: any) {
  // NEW: dropdown open state
  const [showDappMenu, setShowDappMenu] = React.useState(false);
  const [showMarketMenu, setShowMarketMenu] = React.useState(false);

  // Demo options (you'd replace with real data later)
  const dappOptions = ["Raydium", "Orca", "Meteora", "Lifinity"];
  const marketOptions = ["USDC", "USDT", "SOL", "MON"];

  // Close menus when clicking outside
  const dappRef = React.useRef<HTMLDivElement | null>(null);
  const marketRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dappRef.current &&
        !dappRef.current.contains(e.target as Node)
      ) {
        setShowDappMenu(false);
      }
      if (
        marketRef.current &&
        !marketRef.current.contains(e.target as Node)
      ) {
        setShowMarketMenu(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-5 text-sm text-white">
      {/* Tabs */}
      <div className="bg-[#2a2a2a] rounded-md p-1 flex w-full max-w-[360px] border border-[#3a3a3a]">
        <button
          className={`flex-1 rounded-lg cursor-pointer px-4 py-3 text-[14px] font-medium text-left ${
            activeTab === "liquidity"
              ? "bg-[#1E1F1E] text-white"
              : "text-gray-400"
          }`}
          onClick={() => {
            setActiveTab("liquidity");
          }}
        >
          Liquidity provisioning
        </button>
        <button
          className={`flex-1 cursor-pointer rounded-md px-4 py-3 text-[14px] font-medium text-left ${
            activeTab === "swap" ? "bg-[#1E1F1E] text-white" : "text-gray-400"
          }`}
          onClick={() => {
            setActiveTab("swap");
          }}
        >
          Swap
        </button>
      </div>

      {/* Swap tab notice */}
      {activeTab === "swap" && (
        <div className="rounded-lg bg-[#27272A] p-2 text-left w-full flex gap-3">
          <div className="p-2 w-[45px] h-[45px] rounded-md bg-[#181818]">
            <svg
              width="27"
              height="27"
              viewBox="0 0 27 27"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="27" height="27" fill="#181818" />
              <path
                d="M23.625 6.75H3.375C2.92745 6.75 2.49822 6.92779 2.18176 7.24426C1.86529 7.56073 1.6875 7.98995 1.6875 8.4375V16.0312C1.6875 16.4788 1.86529 16.908 2.18176 17.2245C2.49822 17.541 2.92745 17.7188 3.375 17.7188H5.90625V21.0938C5.90625 21.3175 5.99514 21.5321 6.15338 21.6904C6.31161 21.8486 6.52622 21.9375 6.75 21.9375C6.97378 21.9375 7.18839 21.8486 7.34662 21.6904C7.50486 21.5321 7.59375 21.3175 7.59375 21.0938V17.7188H19.4062V21.0938C19.4062 21.3175 19.4951 21.5321 19.6534 21.6904C19.8116 21.8486 20.0262 21.9375 20.25 21.9375C20.4738 21.9375 20.6884 21.8486 20.8466 21.6904C21.0049 21.5321 21.0938 21.3175 21.0938 21.0938V17.7188H23.625C24.0726 17.7188 24.5018 17.541 24.8182 17.2245C25.1347 16.908 25.3125 16.4788 25.3125 16.0312V8.4375C25.3125 7.98995 25.1347 7.56073 24.8182 7.24426C24.5018 6.92779 24.0726 6.75 23.625 6.75ZM23.625 13.5728L18.4897 8.4375H23.625V13.5728ZM8.51027 8.4375L16.104 16.0312H10.896L3.375 8.51027V8.4375H8.51027ZM3.375 10.896L8.51027 16.0312H3.375V10.896ZM23.625 16.0312H18.4897L10.896 8.4375H16.104L23.625 15.9595V16.0312Z"
                fill="#FAFAFA"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold">It will be live soon!</div>
            <div className="text-xs text-gray-400">
              This feature is currently under development
            </div>
          </div>
        </div>
      )}

      {/* LIQUIDITY TAB CONTENT */}
      {activeTab === "liquidity" && (
        <>
          {/* Select Dapp card with dropdown */}
          <div
            className="rounded-xl border border-[#2a2a2a] bg-[#1A1A1A] p-4 text-left w-full relative"
            ref={dappRef}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[14px] text-gray-400 font-medium">
                  Select Dapp
                </div>
                <div className="text-[16px] text-gray-300 font-semibold leading-tight">
                  {selectedDapp}
                </div>
              </div>

              <button
                className="border border-[#2a2a2a] bg-transparent rounded-md h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition"
                onClick={() => {
                  // toggle this dropdown, close the other
                  setShowDappMenu((open) => !open);
                  setShowMarketMenu(false);
                }}
              >
                <ChevronDownIcon
                  className={`h-4 w-4 text-white transition-transform ${
                    showDappMenu ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
            </div>

            {/* dropdown menu for dapp */}
            {showDappMenu && (
              <div className="absolute left-0 top-full mt-2 w-full rounded-lg border border-[#2a2a2a] bg-[#1E1F1E] shadow-xl z-50 overflow-hidden">
                {dappOptions.map((opt: string) => (
                  <button
                    key={opt}
                    className={`w-full text-left px-4 py-3 text-[13px] cursor-pointer flex justify-between items-center hover:bg-[#2a2a2a] ${
                      selectedDapp === opt
                        ? "text-white font-semibold"
                        : "text-gray-300"
                    }`}
                    onClick={() => {
                      setSelectedDapp(opt);
                      setShowDappMenu(false);
                    }}
                  >
                    <span>{opt}</span>
                    {selectedDapp === opt && (
                      <span className="text-[11px] text-emerald-400 font-medium">
                        active
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Select market card with dropdown */}
          <div
            className="rounded-xl border border-[#2a2a2a] bg-[#1A1A1A] p-4 text-left w-full relative"
            ref={marketRef}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {/* token icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d4a8d] text-white text-[12px] font-semibold">
                  $
                </div>
                <div>
                  <div className="text-[14px] text-gray-400 font-medium">
                    Select market
                  </div>
                    <div className="text-[16px] text-gray-300 font-semibold leading-tight flex items-center gap-2">
                      {selectedMarket}
                    </div>
                </div>
              </div>

              <button
                className="border border-[#2a2a2a] bg-transparent rounded-md h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition"
                onClick={() => {
                    // toggle this dropdown, close the other
                    setShowMarketMenu((open) => !open);
                    setShowDappMenu(false);
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
                      setSelectedMarket(opt);
                      setShowMarketMenu(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {/* token circle */}
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2d4a8d] text-white text-[10px] font-semibold">
                        $
                      </span>
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
        </>
      )}
    </div>
  );
}

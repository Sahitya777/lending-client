"use client";
import { Button } from "../ui/button";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import ElectricBorder from "../ElectricBorder";
import { usePathname } from "next/navigation";
import LayoutDashboard from "../../assets/icons/dashboard.png";
import Layers from "../../assets/icons/lend-borrow.png";
import vault from "../../assets/icons/strategicvault.png";
import more from "../../assets/icons/more.png";
import Image from "next/image";
import solicon from "../../assets/cryptoIcons/solana-sol-logo.png";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

const prettyLabel = (slug: string) => {
  if (!slug) return "";
  // turn "some-path" into "Some Path"
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
};

const useNavbarTitle = () => {
  const pathname = usePathname() || "/";
  const clean = pathname.split("?")[0].split("#")[0];

  // take only the first segment for top-level routes
  const firstSeg =
    clean === "/" ? "/" : clean.replace(/^\/|\/$/g, "").split("/")[0];

  switch (firstSeg) {
    case "/":
      return {
        name: "Dashboard",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 10.6666V5.33323C13.9998 5.09941 13.938 4.86977 13.821 4.66734C13.704 4.4649 13.5358 4.2968 13.3333 4.17989L8.66667 1.51323C8.46397 1.3962 8.23405 1.33459 8 1.33459C7.76595 1.33459 7.53603 1.3962 7.33333 1.51323L2.66667 4.17989C2.46418 4.2968 2.29599 4.4649 2.17897 4.66734C2.06196 4.86977 2.00024 5.09941 2 5.33323V10.6666C2.00024 10.9004 2.06196 11.13 2.17897 11.3325C2.29599 11.5349 2.46418 11.703 2.66667 11.8199L7.33333 14.4866C7.53603 14.6036 7.76595 14.6652 8 14.6652C8.23405 14.6652 8.46397 14.6036 8.66667 14.4866L13.3333 11.8199C13.5358 11.703 13.704 11.5349 13.821 11.3325C13.938 11.13 13.9998 10.9004 14 10.6666Z"
              stroke="#FCFCFC"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        ),
      };
    case "lend-borrow":
      return {
        name: "Lend & Borrow",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16.3125 6.75C16.3128 6.6977 16.3057 6.64562 16.2914 6.59531L15.2824 3.06562C15.2146 2.83142 15.0728 2.62544 14.8783 2.47844C14.6838 2.33144 14.4469 2.2513 14.2031 2.25H3.79688C3.55306 2.2513 3.3162 2.33144 3.12168 2.47844C2.92715 2.62544 2.7854 2.83142 2.71758 3.06562L1.7093 6.59531C1.69477 6.64559 1.68743 6.69767 1.6875 6.75V7.875C1.6875 8.31163 1.78916 8.74226 1.98442 9.13279C2.17969 9.52332 2.4632 9.86302 2.8125 10.125V15.1875C2.8125 15.3367 2.87176 15.4798 2.97725 15.5852C3.08274 15.6907 3.22582 15.75 3.375 15.75H14.625C14.7742 15.75 14.9173 15.6907 15.0227 15.5852C15.1282 15.4798 15.1875 15.3367 15.1875 15.1875V10.125C15.5368 9.86302 15.8203 9.52332 16.0156 9.13279C16.2108 8.74226 16.3125 8.31163 16.3125 7.875V6.75ZM3.79688 3.375H14.2031L15.0061 6.1875H2.99602L3.79688 3.375ZM7.3125 7.3125H10.6875V7.875C10.6875 8.32255 10.5097 8.75178 10.1932 9.06824C9.87678 9.38471 9.44755 9.5625 9 9.5625C8.55245 9.5625 8.12323 9.38471 7.80676 9.06824C7.49029 8.75178 7.3125 8.32255 7.3125 7.875V7.3125ZM6.1875 7.3125V7.875C6.1874 8.16518 6.11247 8.45044 5.96995 8.70321C5.82743 8.95598 5.62213 9.16773 5.37389 9.31801C5.12565 9.46828 4.84285 9.552 4.55281 9.56108C4.26276 9.57016 3.97528 9.50429 3.71813 9.36984C3.679 9.33939 3.63596 9.31432 3.59016 9.29531C3.35185 9.14275 3.15573 8.93272 3.01984 8.68453C2.88395 8.43633 2.81265 8.15796 2.8125 7.875V7.3125H6.1875ZM14.0625 14.625H3.9375V10.6312C4.12268 10.6686 4.3111 10.6874 4.5 10.6875C4.93663 10.6875 5.36726 10.5858 5.75779 10.3906C6.14832 10.1953 6.48802 9.9118 6.75 9.5625C7.01198 9.9118 7.35168 10.1953 7.74221 10.3906C8.13274 10.5858 8.56337 10.6875 9 10.6875C9.43663 10.6875 9.86726 10.5858 10.2578 10.3906C10.6483 10.1953 10.988 9.9118 11.25 9.5625C11.512 9.9118 11.8517 10.1953 12.2422 10.3906C12.6327 10.5858 13.0634 10.6875 13.5 10.6875C13.6889 10.6874 13.8773 10.6686 14.0625 10.6312V14.625ZM14.4091 9.29531C14.3639 9.31436 14.3214 9.33917 14.2826 9.36914C14.0255 9.50373 13.738 9.56973 13.4479 9.56077C13.1578 9.5518 12.8749 9.46818 12.6266 9.31796C12.3783 9.16775 12.1729 8.95604 12.0303 8.70327C11.8877 8.4505 11.8127 8.16522 11.8125 7.875V7.3125H15.1875V7.875C15.1873 8.15802 15.1159 8.43644 14.9799 8.68464C14.8438 8.93283 14.6476 9.14283 14.4091 9.29531Z"
              fill="#FCFCFC"
            />
          </svg>
        ),
      };
    case "strategic-vaults":
      return {
        name: "Farm (50x)",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14.25 2.25H3.75C2.92157 2.25 2.25 2.92157 2.25 3.75V14.25C2.25 15.0784 2.92157 15.75 3.75 15.75H14.25C15.0784 15.75 15.75 15.0784 15.75 14.25V3.75C15.75 2.92157 15.0784 2.25 14.25 2.25Z"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.625 6C5.83211 6 6 5.83211 6 5.625C6 5.41789 5.83211 5.25 5.625 5.25C5.41789 5.25 5.25 5.41789 5.25 5.625C5.25 5.83211 5.41789 6 5.625 6Z"
              fill="#FCFCFC"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.92505 5.92493L7.95005 7.94993"
              stroke="#FCFCFC"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12.375 6C12.5821 6 12.75 5.83211 12.75 5.625C12.75 5.41789 12.5821 5.25 12.375 5.25C12.1679 5.25 12 5.41789 12 5.625C12 5.83211 12.1679 6 12.375 6Z"
              fill="#FCFCFC"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10.05 7.94993L12.075 5.92493"
              stroke="#FCFCFC"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.625 12.75C5.83211 12.75 6 12.5821 6 12.375C6 12.1679 5.83211 12 5.625 12C5.41789 12 5.25 12.1679 5.25 12.375C5.25 12.5821 5.41789 12.75 5.625 12.75Z"
              fill="#FCFCFC"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.92505 12.0749L7.95005 10.0499"
              stroke="#FCFCFC"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12.375 12.75C12.5821 12.75 12.75 12.5821 12.75 12.375C12.75 12.1679 12.5821 12 12.375 12C12.1679 12 12 12.1679 12 12.375C12 12.5821 12.1679 12.75 12.375 12.75Z"
              fill="#FCFCFC"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10.05 10.0499L12.075 12.0749"
              stroke="#FCFCFC"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M9 10.5C9.82843 10.5 10.5 9.82843 10.5 9C10.5 8.17157 9.82843 7.5 9 7.5C8.17157 7.5 7.5 8.17157 7.5 9C7.5 9.82843 8.17157 10.5 9 10.5Z"
              stroke="#FCFCFC"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        ),
      };
    default:
      return {
        name: prettyLabel(firstSeg),
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16.3125 6.75C16.3128 6.6977 16.3057 6.64562 16.2914 6.59531L15.2824 3.06562C15.2146 2.83142 15.0728 2.62544 14.8783 2.47844C14.6838 2.33144 14.4469 2.2513 14.2031 2.25H3.79688C3.55306 2.2513 3.3162 2.33144 3.12168 2.47844C2.92715 2.62544 2.7854 2.83142 2.71758 3.06562L1.7093 6.59531C1.69477 6.64559 1.68743 6.69767 1.6875 6.75V7.875C1.6875 8.31163 1.78916 8.74226 1.98442 9.13279C2.17969 9.52332 2.4632 9.86302 2.8125 10.125V15.1875C2.8125 15.3367 2.87176 15.4798 2.97725 15.5852C3.08274 15.6907 3.22582 15.75 3.375 15.75H14.625C14.7742 15.75 14.9173 15.6907 15.0227 15.5852C15.1282 15.4798 15.1875 15.3367 15.1875 15.1875V10.125C15.5368 9.86302 15.8203 9.52332 16.0156 9.13279C16.2108 8.74226 16.3125 8.31163 16.3125 7.875V6.75ZM3.79688 3.375H14.2031L15.0061 6.1875H2.99602L3.79688 3.375ZM7.3125 7.3125H10.6875V7.875C10.6875 8.32255 10.5097 8.75178 10.1932 9.06824C9.87678 9.38471 9.44755 9.5625 9 9.5625C8.55245 9.5625 8.12323 9.38471 7.80676 9.06824C7.49029 8.75178 7.3125 8.32255 7.3125 7.875V7.3125ZM6.1875 7.3125V7.875C6.1874 8.16518 6.11247 8.45044 5.96995 8.70321C5.82743 8.95598 5.62213 9.16773 5.37389 9.31801C5.12565 9.46828 4.84285 9.552 4.55281 9.56108C4.26276 9.57016 3.97528 9.50429 3.71813 9.36984C3.679 9.33939 3.63596 9.31432 3.59016 9.29531C3.35185 9.14275 3.15573 8.93272 3.01984 8.68453C2.88395 8.43633 2.81265 8.15796 2.8125 7.875V7.3125H6.1875ZM14.0625 14.625H3.9375V10.6312C4.12268 10.6686 4.3111 10.6874 4.5 10.6875C4.93663 10.6875 5.36726 10.5858 5.75779 10.3906C6.14832 10.1953 6.48802 9.9118 6.75 9.5625C7.01198 9.9118 7.35168 10.1953 7.74221 10.3906C8.13274 10.5858 8.56337 10.6875 9 10.6875C9.43663 10.6875 9.86726 10.5858 10.2578 10.3906C10.6483 10.1953 10.988 9.9118 11.25 9.5625C11.512 9.9118 11.8517 10.1953 12.2422 10.3906C12.6327 10.5858 13.0634 10.6875 13.5 10.6875C13.6889 10.6874 13.8773 10.6686 14.0625 10.6312V14.625ZM14.4091 9.29531C14.3639 9.31436 14.3214 9.33917 14.2826 9.36914C14.0255 9.50373 13.738 9.56973 13.4479 9.56077C13.1578 9.5518 12.8749 9.46818 12.6266 9.31796C12.3783 9.16775 12.1729 8.95604 12.0303 8.70327C11.8877 8.4505 11.8127 8.16522 11.8125 7.875V7.3125H15.1875V7.875C15.1873 8.15802 15.1159 8.43644 14.9799 8.68464C14.8438 8.93283 14.6476 9.14283 14.4091 9.29531Z"
              fill="#FCFCFC"
            />
          </svg>
        ),
      };
  }
};

const Navbar = () => {
  const { setShowAuthFlow, handleLogOut, user, primaryWallet } =
    useDynamicContext();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const handleCreateLink = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error:", error);
      setMessage("An error occurred while creating the link");
    } finally {
      setIsLoading(false);
    }
  };

  const title = useNavbarTitle();
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const copyAddress = async () => {
    if (!primaryWallet?.address) return;
    await navigator.clipboard.writeText(primaryWallet.address);
  };

  return (
    <div className="px-8 py-4 flex w-full items-center justify-between bg-transparent">
      <div className="flex items-center gap-3 text-white font-semibold">
        <div className="cursor-pointer">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.6667 2H3.33333C2.59695 2 2 2.59695 2 3.33333V12.6667C2 13.403 2.59695 14 3.33333 14H12.6667C13.403 14 14 13.403 14 12.6667V3.33333C14 2.59695 13.403 2 12.6667 2Z"
              stroke="#FCFCFC"
              stroke-width="1.33333"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6 2V14"
              stroke="#FCFCFC"
              stroke-width="1.33333"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div className="h-[36px] w-[1px] border-[#222322] bg-[#222322]"></div>

        <div className="h-[36px] w-[36px] rounded-md bg-[#1F1F1F] flex items-center justify-center">
          {title.icon}
        </div>
        {title.name}
      </div>

      {!user ? (
        <div className="flex gap-2 items-center">
          <Button
            className="flex gap-2 cursor-pointer bg-[#FECD6D] text-black hover:bg-[#fece6dd5]"
            onClick={handleCreateLink}
            disabled={isLoading}
          >
            <TrendingUp />
            Increase Leverage (5x)
          </Button>

          <ElectricBorder
            color="#10b981"
            speed={1}
            chaos={0.5}
            thickness={2}
            style={{ borderRadius: 24 }}
            className="p-0.5"
          >
            <Button
              className="cursor-pointer rounded-lg bg-[#FECD6D] text-black hover:bg-[#fece6dd5] font-semibold"
              onClick={() => setShowAuthFlow(true)}
            >
              Connect Wallet
            </Button>
          </ElectricBorder>
        </div>
      ) : (
        <div className="flex gap-2 items-center relative">
          {/* Leverage button stays the same */}
          <Button
            className="flex gap-2 cursor-pointer bg-[#FECD6D] text-black hover:bg-[#fece6dd5]"
            onClick={handleCreateLink}
            disabled={isLoading}
          >
            <TrendingUp />
            Increase Leverage (5x)
          </Button>

          {/* Wallet pill + dropdown */}
          <div className="relative">
            {/* clickable wallet pill */}
            <button
              className="border flex gap-2 items-center p-2 bg-[#1E1F1E] text-white rounded-md text-sm cursor-pointer hover:bg-[#2a2a2a] transition"
              onClick={() => setShowWalletMenu((prev) => !prev)}
            >
              <Image
                src={solicon || "/placeholder.svg"}
                alt={"sol"}
                height={12}
                width={12}
                className="object-contain"
              />
              <span className="font-medium">
                {primaryWallet?.address?.slice(0, 5)}...
                {primaryWallet?.address?.slice(-5)} (devnet)
              </span>

              {/* small chevron to indicate dropdown */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className={`transition-transform ${
                  showWalletMenu ? "rotate-180" : "rotate-0"
                }`}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* dropdown menu (Logout) */}
            {showWalletMenu && (
              <div className="absolute left-0 top-full mt-2 w-54 rounded-lg border border-[#2a2a2a] bg-[#1E1F1E] shadow-lg p-3 z-50 space-y-3">
                {/* Full address row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-300 text-xs font-mono max-w-[80%] truncate">
                    {primaryWallet?.address}
                  </div>
                  <button
                    className="text-[#FECD6D] hover:text-[#feda8b] cursor-pointer"
                    onClick={copyAddress}
                    title="Copy address"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-[#2a2a2a]" />

                {/* Logout Button */}
                <button
                  className="w-full text-left text-[13px] font-semibold text-black bg-[#FECD6D] hover:bg-[#fece6dd5] rounded-md px-3 py-2 cursor-pointer"
                  onClick={() => {
                    setShowWalletMenu(false);
                    handleLogOut();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;

"use client";
import React from "react";
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
      return { name: "Dashboard", icon: LayoutDashboard };
    case "lend-borrow":
      return { name: "Lend & Borrow", icon: Layers };
    case "strategic-vaults":
      return { name: "Strategic Vaults", icon: vault };
    default:
      return { name: prettyLabel(firstSeg), icon: more };
  }
};

const Navbar = () => {
  const { setShowAuthFlow, handleLogOut, user, primaryWallet } =
    useDynamicContext();

  const title = useNavbarTitle();

  return (
    <div className="px-8 py-4 flex w-full items-center justify-between">
      <div className="flex items-center gap-3 text-[#272627] font-semibold">
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
              stroke="#272627"
              stroke-width="1.33333"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6 2V14"
              stroke="#272627"
              stroke-width="1.33333"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div className="h-[36px] w-[1px] border-[#EAEBEA] bg-[#EAEBEA]"></div>

        <div className="h-[36px] w-[36px] rounded-md bg-white border-[#EAEBEA] border flex items-center justify-center">
          <Image src={title.icon} height={16} width={16} alt="it" />
        </div>
        {title.name}
      </div>

      {!user ? (
        <ElectricBorder
          color="#7df9ff"
          speed={1}
          chaos={0.5}
          thickness={2}
          style={{ borderRadius: 24 }}
          className="p-0.5"
        >
          <Button
            className="cursor-pointer rounded-lg"
            onClick={() => setShowAuthFlow(true)}
          >
            Connect Wallet
          </Button>
        </ElectricBorder>
      ) : (
        <div className="flex gap-2 items-center">
          <div className="border flex gap-2 items-center border-amber-200 p-2 bg-white rounded-md">
            <Image src={solicon} alt={"sol"} height={12} width={12} className="object-contain" />
            {primaryWallet?.address?.slice(0, 5)}...
            {primaryWallet?.address?.slice(-5)}
          </div>
          <Button
            className="cursor-pointer bg-[#592EFF]"
            onClick={() => handleLogOut()}
          >
            Logout
          </Button>
        </div>
      )}
    </div>
  );
};

export default Navbar;

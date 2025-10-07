// components/Sidebar.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Layers, Coins, MoreHorizontal } from "lucide-react";
import SplitText from "@/components/SplitText";
import { Button } from "@/components/ui/button";
import { GoPin } from "react-icons/go";
import { cn } from "@/lib/utils";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PIN_KEY = "ui.sidebar.pinned";

export default function Sidebar() {
  // read pinned/expanded from localStorage (safe for SSR)
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PIN_KEY) === "1";
  });

  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PIN_KEY) === "1"; // start open if pinned
  });

  const router = useRouter();

  // keep localStorage in sync when pinned changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    if (pinned) setExpanded(true); // pinned should force open
  }, [pinned]);

  // also react to storage events (other tabs/windows/pages)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PIN_KEY) return;
      const val = e.newValue === "1";
      setPinned(val);
      if (val) setExpanded(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---- Solana latest block (unchanged) ----
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const connection = useMemo(
    () => new Connection(clusterApiUrl("testnet"), "confirmed"),
    []
  );

  useEffect(() => {
    let alive = true;
    async function getLatestBlockHeight() {
      try {
        const height = await connection.getBlockHeight("confirmed");
        if (!alive) return;
        setBlockHeight(height);
        setStatus("ok");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        console.error("Failed to fetch Solana testnet block height:", e);
      }
    }
    getLatestBlockHeight();
    const id = setInterval(getLatestBlockHeight, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [connection]);
  // ----------------------------------------

  const toggleSidebar = () => {
    if (pinned) return; // don't collapse if pinned
    setExpanded((e) => !e);
  };

  const togglePin = () => setPinned((p) => !p);

  const handleAnimationComplete = () => {
    // optional
  };

  const sideBaritems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Layers, label: "Lend & Borrow", href: "/lend-borrow" },
    { icon: Coins, label: "Strategic Vaults", href: "/strategic-vaults" },
    { icon: MoreHorizontal, label: "More" },
  ];

  const dotColor =
    status === "ok" ? "#22c55e" : status === "error" ? "#ef4444" : "#eab308";

  return (
    <motion.aside
      onMouseEnter={() => !pinned && setExpanded(true)}
      onMouseLeave={() => !pinned && setExpanded(false)}
      onClick={toggleSidebar}
      animate={{ width: expanded ? 220 : 72 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "h-[80vh] bg-[#0f172a] text-white flex flex-col justify-between shadow-lg sticky top-0 left-5 rounded-md"
      )}
    >
      <div>
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-4">
          <motion.div
            initial={false}
            animate={{ opacity: expanded ? 1 : 0 }}
            className="font-semibold text-lg"
          >
            {expanded && (
              <SplitText
                text="Lending Protocol"
                className="text-xl font-semibold text-center"
                delay={100}
                duration={0.6}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-100px"
                textAlign="center"
                onLetterAnimationComplete={handleAnimationComplete}
              />
            )}
          </motion.div>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation(); // don't toggle expand when clicking pin
              togglePin();
            }}
            className="text-gray-400 cursor-pointer hover:bg-transparent hover:text-gray-600"
          >
            {pinned ? <GoPin className="text-white" size={18} /> : <GoPin size={18} />}
          </Button>
        </div>

        {/* Nav */}
        <nav className="space-y-1 mt-4">
          {sideBaritems.map((item, i) => (
            <button
              key={i}
              onClick={() => item.href && router.replace(item.href)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-md cursor-pointer hover:bg-[#1e293b] transition-colors",
                expanded ? "justify-start" : "justify-center"
              )}
            >
              <item.icon size={20} />
              {expanded && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-700 flex items-center gap-3">
        <span
          className="pulsatingDot"
          style={{ ["--pulsating-dot" as any]: dotColor }}
          aria-label={status === "ok" ? "online" : status === "error" ? "error" : "loading"}
        />
        {expanded && (
          <Link
            href={`https://explorer.solana.com/block/${blockHeight}?cluster=testnet`}
            target="_blank"
          >
            <span className="text-sm text-gray-300 cursor-pointer hover:underline">
              {blockHeight ? `${blockHeight}` : "Loading…"}
            </span>
          </Link>
        )}
      </div>
    </motion.aside>
  );
}

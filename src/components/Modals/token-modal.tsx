// components/TestTokensModal.tsx
import React, { useState } from "react";
import ResponsiveModal from "./responsive-modal";
import Image from "next/image";
import { Button } from "../ui/button";
import { markets } from "../MarketDashboard";
import { useToast } from "@/hooks/useToast";

const TestTokensModal = ({
  openModal,
  setOpenModal,
  connectedPubkey, // <--- pass this from parent (string or null)
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
  connectedPubkey: string | null;
}) => {
  const [isMinting, setIsMinting] = useState<string | null>(null);
  const { toast } = useToast();
  const handleMint = async (tokenName: string, mintAddress: string) => {
    if (!connectedPubkey) {
      alert("Please connect your wallet first.");
      return;
    }

    try {
      setIsMinting(tokenName);
      const resp = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mintAddress,
          amount: 10, // mint 1 token (floating allowed, server multiplies by decimals)
          recipient: connectedPubkey,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        console.error("mint error", json);
      } else {
        toast({
          title: "Mint Successfull",
          description: `10 ${tokenName} have been minted successfully to your account`,
        });
        setOpenModal(false)
        // alert(`Mint success. tx: ${json.signature}`);
        // optionally refresh UI, fetch token balances, etc.
      }
    } catch (err) {
      console.error("mint failed for", tokenName, err);
      toast({
        title: "Mint Failed",
        description: `Your withdraw has failed ${err}`,
        variant: "destructive",
      });
    } finally {
      setIsMinting(null);
    }
  };

  return (
    <ResponsiveModal open={openModal} onOpenChange={setOpenModal}>
      <div className="max-h-[90dvh] overflow-y-auto flex flex-col relative z-10">
        <div className="flex flex-col gap-5">
          <h2 className="text-2xl text-center text-white font-medium">
            Get Test Tokens
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
            {markets.map((token) => (
              <div
                key={token.name}
                className="flex flex-1 flex-col justify-between border border-[#494B4E] rounded-[10px] p-4 bg-[#0F0F10] min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 relative shrink-0">
                      <Image
                        src={token.icon}
                        alt={token.symbol}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-sm font-medium leading-tight truncate">
                        {token.name}
                      </span>
                      <span className="text-[#A4A4AE] text-[11px] leading-tight truncate">
                        {token.symbol}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  disabled={isMinting === token.name}
                  onClick={() => handleMint(token.name, token.mintAddress)}
                  className="flex gap-2 mt-4 cursor-pointer bg-[#FECD6D] text-black hover:bg-[#fece6dd5]"
                >
                  {isMinting === token.name
                    ? "Minting..."
                    : `Get ${token.name}`}
                </Button>

                <p className="text-[10px] text-[#A4A4AE] text-center mt-2 leading-snug">
                  Faucet mint to your connected wallet.
                </p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[#6B6B76] text-center leading-relaxed px-4">
            These are testnet tokens only. They have no real-world value.
          </p>
          <div className="text-[11px] text-gray-500 text-center">
            Powered by OwlFi
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default TestTokensModal;

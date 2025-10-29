import React, { useState } from "react";
import ResponsiveModal from "./responsive-modal";
import Image from "next/image";
import { Button } from "../ui/button";
import { markets } from "../MarketDashboard";

// if you already have this in another file, import instead of redefining

const TestTokensModal = ({
  openModal,
  setOpenModal,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [isMinting, setIsMinting] = useState<string | null>(null);

  // call your faucet / mint instruction etc here
  const handleMint = async (tokenSymbol: string, mintAddress: string) => {
    try {
      setIsMinting(tokenSymbol);
      // TODO: hook up on-chain mint / faucet logic
      // await mintTestToken({ mintAddress })
    } catch (err) {
      console.error("mint failed for", tokenSymbol, err);
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

          {/* token cards row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
            {markets.map((token) => (
              <div
                key={token.name}
                className="flex flex-1 flex-col justify-between border border-[#494B4E] rounded-[10px] p-4 bg-[#0F0F10] min-w-0"
              >
                {/* top section: icon + ticker */}
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

                {/* CTA */}
                <Button
                  disabled={isMinting === token.name}
                  onClick={() => handleMint(token.name, token.mintAddress)}
                  className="flex gap-2 mt-4 cursor-pointer bg-[#FECD6D] text-black hover:bg-[#fece6dd5]"
                >
                  {isMinting === token.name
                    ? "Minting..."
                    : `Get ${token.name}`}
                </Button>

                {/* helper text */}
                <p className="text-[10px] text-[#A4A4AE] text-center mt-2 leading-snug">
                  Faucet mint to your connected wallet.
                </p>
              </div>
            ))}
          </div>

          {/* optional footer / disclaimer */}
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

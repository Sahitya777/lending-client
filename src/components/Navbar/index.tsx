"use client";
import React from "react";
import { Button } from "../ui/button";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import ElectricBorder from "../ElectricBorder";

const Navbar = () => {
  const { setShowAuthFlow, handleLogOut, user, primaryWallet } =
    useDynamicContext();
  console.log(user, primaryWallet?.address, "user");
  return (
    <div className="px-8 py-4 flex w-full justify-between">
      <div>Logo</div>
      {!user ? (
        <ElectricBorder
          color="#7df9ff"
          speed={1}
          chaos={0.5}
          thickness={2}
          style={{ borderRadius: 24 }}
          className={"p-0.5"}
        >
          <Button
            className="cursor-pointer rounded-lg"
            onClick={() => {
              setShowAuthFlow(true);
            }}
          >
            Connect Wallet
          </Button>
        </ElectricBorder>
      ) : (
        <div className="flex gap-2 items-center">
          <div>
            {primaryWallet?.address.slice(0, 5)}...
            {primaryWallet?.address.slice(
              primaryWallet?.address.length - 5,
              primaryWallet.address.length
            )}
          </div>
          <Button
            className="cursor-pointer"
            onClick={() => {
              handleLogOut();
            }}
          >
            Logout
          </Button>
        </div>
      )}
    </div>
  );
};

export default Navbar;

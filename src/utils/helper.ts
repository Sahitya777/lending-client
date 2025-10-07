// src/utils/getTokenIcon.ts

import btcicon from "../assets/cryptoIcons/bitcoin-btc-logo.png";
import ethicon from "../assets/cryptoIcons/ethereum-eth-logo.png";
import solicon from "../assets/cryptoIcons/solana-sol-logo.png";
import usdcicon from "../assets/cryptoIcons/usd-coin-usdc-logo.png";
import usdticon from "../assets/cryptoIcons/tether-usdt-logo.png";
import suiicon from "../assets/cryptoIcons/sui-sui-logo.png";

export function getTokenIcon(tokenName: string) {
  const name = tokenName?.toUpperCase?.().trim();

  switch (name) {
    case "BTC":
    case "BITCOIN":
      return btcicon;
    case "ETH":
    case "ETHEREUM":
      return ethicon;
    case "SOL":
    case "SOLANA":
      return solicon;
    case "USDC":
    case "USD COIN":
      return usdcicon;
    case "USDT":
    case "TETHER":
    case "TETHER USD":
      return usdticon;
    case "SUI":
      return suiicon;
    default:
      return undefined; // or a default placeholder icon if you have one
  }
}

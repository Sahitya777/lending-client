export type Market = {
  name: string;
  symbol: string;
  price: number;
  apy: number;
  apr: number;
  totalSupply: number;
  totalBorrow: number;
  tier: string;
  rewards: boolean;
  icon: string | any;
};

export type filter= "All" | "Shared" | "Isolated" | "Cross"
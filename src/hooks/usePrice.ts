// usePythPrice.ts
import { useEffect, useState } from "react";

export type PythPrice = {
  price: number | null;         // human-readable price (already scaled)
  conf: number | null;          // confidence interval
  publishTime: number | null;   // unix seconds
  isStale: boolean;
  isError: boolean;
};

async function fetchPythPrice(feedId: string) {
  // Example endpoint shape:
  // GET https://hermes.pyth.network/api/latest_price_feeds?ids[]=<FEED_ID>
  //
  // Response (array[0]):
  // {
  //   price: { price: "64321.12", conf: "12.3", expo: -2 },
  //   publish_time: 1729876543
  //   ...
  // }

  const url = `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${feedId}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch price");

  const data = await res.json();
  const feed = data[0];

  const rawPrice = parseFloat(feed.price.price);    // "64321.12" -> 64321.12
  const conf = parseFloat(feed.price.conf);         // "12.3" -> 12.3
  const expo     = feed.price.expo;  
  const publishTime = feed.publish_time;            // unix seconds

  return {
    price: rawPrice/10**(-expo),
    conf,
    expo,
    publishTime,
  };
}

export function usePythPrice(
  feedId: string,
  refreshMs = 100_000 // poll every 1s
): PythPrice {
  const [state, setState] = useState<PythPrice>({
    price: null,
    conf: null,
    publishTime: null,
    isStale: false,
    isError: false,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      try {
        const { price, conf, publishTime } = await fetchPythPrice(feedId);
        const nowSec = Math.floor(Date.now() / 1000);
        const ageSec = nowSec - publishTime;

        if (!cancelled) {
          setState({
            price,
            conf,
            publishTime,
            isStale: ageSec > 5, // You decide what "stale" means
            isError: false,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isError: true,
          }));
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(tick, refreshMs);
        }
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [feedId, refreshMs]);

  return state;
}

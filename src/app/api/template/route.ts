import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const response = await fetch(
      `https://mobile-api.opacity.network/api/app-links/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: process.env.NEXT_PBULIC_LUMANLABS_KEY,
          templateId: "04a6b0d9-65bc-4588-a0ad-c9f006e198eb",
          flowParams: [{ quoteAsset: "USDT" }],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API call failed with status ${response.status}: ${JSON.stringify(
          errorData
        )}`
      );
    }

    const data = (await response.json()).data;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error calling Opacity API:", error);
    throw error;
  }
}

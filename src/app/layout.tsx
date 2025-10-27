import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Owl Finance",
  description: "Undercollateralized lending platform on Solana — borrow and lend with confidence.",
  keywords: ["DeFi", "Solana", "Lending", "Borrowing", "Finance"],
  openGraph: {
    title: "Owl Finance",
    description: "Undercollateralized lending platform on Solana.",
    url: "https://owlfi.vercel.app",
    siteName: "Owl Finance",
    images: [
      {
        url: "/favicon.png", // or a social image
        width: 1200,
        height: 630,
        alt: "Owl Finance Dashboard",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Owl Finance",
    description: "Undercollateralized lending platform on Solana.",
    images: ["/favicon.png"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let keyvalue=process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_KEY!
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DynamicContextProvider
          settings={{
            environmentId: keyvalue,
            walletConnectors: [SolanaWalletConnectors],
          }}
        >
          {children}
        </DynamicContextProvider>
      </body>
    </html>
  );
}

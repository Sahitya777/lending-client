"use client";

import React from "react";
import Image from "next/image";
import { AlertTriangle, Lock, Shield } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { getTokenIcon } from "@/utils/helper";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";

import {
  getConnection,
  fetchSolBalanceSOL,
  buildApproveAndDepositSolTx,
  fetchSplTokenBalance,
  buildDepositSolTx,
  WSOL_MINT,
} from "@/utils/chain/solana";
import {
  buildDepositTx,
  buildWithdrawTx,
  extractAnchorError,
  fetchMarketViewRawWeb3,
  fetchProtocolHeldTokenBalance,
  fetchUserPositionViewRawWeb3,
  simulateForUi,
} from "@/utils/chain/helper";

function InfoRow({
  icon,
  title,
  right,
  accent,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-4 py-3 ${
        accent ? "bg-muted/50" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="text-sm text-muted-foreground">{right}</div>
    </div>
  );
}

export default function DepositPanel({
  lastSegment,
}: {
  lastSegment: string | undefined;
}) {
  const [amount, setAmount] = React.useState("");
  const [useLending, setUseLending] = React.useState(true);
  const [useCollateral, setUseCollateral] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [txSig, setTxSig] = React.useState("");
  console.log(balance, "balance");

  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [pubkey, setPubkey] = React.useState<PublicKey | null>(null);

  const icon = getTokenIcon(lastSegment as string);
  const canDeposit = !!pubkey && amount !== "" && Number(amount) > 0 && !busy;
  const NATIVE_MINT = new PublicKey(
    "84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk"
  );
  // Resolve Solana public key from Dynamic
  React.useEffect(() => {
    console.log("entry");
    if (
      primaryWallet &&
      isSolanaWallet(primaryWallet) &&
      primaryWallet.address
    ) {
      try {
        setPubkey(new PublicKey(primaryWallet.address));
      } catch {
        setPubkey(null);
      }
    } else {
      setPubkey(null);
    }
  }, [primaryWallet]);

  React.useEffect(() => {
    (async () => {
      if (!pubkey) {
        // setDepositedShares(null);
        return;
      }
      const connection = getConnection();

      const view = await fetchUserPositionViewRawWeb3({
        owner: pubkey,
        marketMint: NATIVE_MINT,
        connection,
        commitment: "confirmed",
      });
      console.log(view, "view");

      // setDepositedShares(view.depositedSharesUi);
      // You can also stash view.pda if you want to show "your position account" in Explorer
    })();
  }, [pubkey]);

  const [marketData, setMarketData] = React.useState<{
    totalDepositsUi: number;
    totalBorrowsUi: number;
    totalReservesUi: number;
    utilization: number;
    borrowApr: number;
    supplyApr: number;
    paused: boolean;
  } | null>(null);
  console.log(marketData, "marketData");
  React.useEffect(() => {
    (async () => {
      if (!pubkey) return;

      const connection = getConnection();

      // 1. user position
      const posView = await fetchUserPositionViewRawWeb3({
        owner: pubkey,
        marketMint: NATIVE_MINT,
        connection,
        commitment: "confirmed",
      });

      // 2. market view
      const mv = await fetchMarketViewRawWeb3({
        marketMint: NATIVE_MINT,
        connection,
        commitment: "confirmed",
      });

      // --- compute derived values ---
      const totalDeposits = Number(mv.totalDepositsUi);
      const totalBorrows = Number(mv.totalBorrowsUi);
      const reserveFactor = Number(mv.reserveFactorRaw) / 10000; // assume bps

      const utilization = totalDeposits > 0 ? totalBorrows / totalDeposits : 0;

      // simple heuristic: base borrow APR rises with utilization
      // e.g. 2% base + up to 20% max near full utilization
      const baseRate = 0.02;
      const slope1 = 0.2; // linear up to 100%
      const borrowApr = baseRate + slope1 * utilization;

      // supply APR = borrow APR * utilization * (1 - reserveFactor)
      const supplyApr = borrowApr * utilization * (1 - reserveFactor);

      setMarketData({
        totalDepositsUi: mv.totalDepositsUi,
        totalBorrowsUi: mv.totalBorrowsUi,
        totalReservesUi: mv.totalReservesUi as any,
        utilization,
        borrowApr,
        supplyApr,
        paused: mv.paused,
      });
    })();
  }, [pubkey]);

  // READ: fetch SOL balance on mount / wallet change
  React.useEffect(() => {
    (async () => {
      if (!pubkey) {
        setBalance(null);
        return;
      }
      try {
        // You can use Dynamic's connection OR your own
        const connection = getConnection();
        const sol = await fetchSolBalanceSOL(pubkey);
        const NATIVE_MINT = new PublicKey(
          "84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk"
        );

        const bal = await fetchSplTokenBalance(pubkey, NATIVE_MINT);
        console.log("USDC balance:", bal);

        setBalance(bal);
      } catch {
        setBalance(null);
      }
    })();
  }, [pubkey, primaryWallet]);

  const onApproveAndDeposit = async () => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet) || !pubkey) {
      setShowAuthFlow(true);
      return;
    }

    setBusy(true);
    setTxSig("");

    try {
      const value = Number(amount);
      if (value <= 0) throw new Error("Enter valid amount");

      const connection = getConnection();

      // 1. get instruction + PDAs (no blockhash yet)
      const { ix } = await buildDepositTx({
        owner: pubkey,
        mint: new PublicKey("84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk"),
        amountUi: value,
        mintDecimals: 9,
        connection: connection as any,
      });

      // 2. create a brand new transaction using a FRESH blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized"); // "processed" also fine, "finalized" more stable

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      // stash lastValidBlockHeight so we can confirm later
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      // 4. sign and send the SAME freshTx
      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        const rawTx = signedTx.serialize();
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        // await connection.confirmTransaction(
        //   {
        //     signature: sig,
        //     blockhash: freshTx.recentBlockhash!,
        //     lastValidBlockHeight,
        //   },
        //   "confirmed"
        // );

        setBalance(await fetchSplTokenBalance(pubkey, NATIVE_MINT));
      } catch (sendErr: any) {
        // if it's a SendTransactionError, pull logs
        // if (sendErr instanceof SendTransactionError) {
        //   const logs = await sendErr.getLogs(connection);
        //   console.error("SendTransactionError logs:", logs);
        // }
        throw sendErr;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onApproveAndWithdraw = async () => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet) || !pubkey) {
      setShowAuthFlow(true);
      return;
    }

    setBusy(true);
    setTxSig("");

    try {
      // 1. parse user input
      const value = Number(amount); // the "amount to withdraw" field in your UI
      if (value <= 0) throw new Error("Enter valid amount");

      const connection = getConnection();

      // 2. build withdraw instruction (no blockhash yet!)
      const { ix } = await buildWithdrawTx({
        owner: pubkey,
        mint: new PublicKey("84iD9iK7Xpt4YgfscT6piausnWnVZ4bs5XqEFrtrZVZk"),
        sharesUi: value,
        shareDecimals: 9, // <-- IMPORTANT: this is SHARES decimals, not underlying mint decimals
      });

      // 3. get a FRESH blockhash and assemble the transaction we will actually send
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");

      const freshTx = new Transaction();
      freshTx.add(ix);
      freshTx.feePayer = pubkey;
      freshTx.recentBlockhash = blockhash;
      (freshTx as any)._lastValidBlockHeight = lastValidBlockHeight;

      // 4. simulate THIS tx before prompting wallet

      // 5. request wallet signature
      const signer = await primaryWallet.getSigner();
      const signedTx = await signer.signTransaction(freshTx as any);

      try {
        // 6. broadcast
        const rawTx = signedTx.serialize();
        console.log(rawTx, "tx");
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        setTxSig(sig);

        // 7. confirm
        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: freshTx.recentBlockhash!,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        // 8. refresh balances
        setBalance(await fetchSplTokenBalance(pubkey, NATIVE_MINT));
      } catch (sendErr: any) {
        // if (sendErr instanceof SendTransactionError) {
        //   const logs = await sendErr.getLogs(connection);
        //   console.error("SendTransactionError logs (withdraw):", logs);
        // }
        throw sendErr;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-xl rounded-lg border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Deposit</CardTitle>
          <div className="text-right">
            {pubkey ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Wallet SOL balance{" "}
                  <span className="font-semibold">
                    {balance === null ? "…" : balance.toFixed(6)} SOL
                  </span>
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Connect wallet</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Token + Amount */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              {icon ? (
                <Image src={icon} alt="logo" height={18} width={18} />
              ) : (
                <div className="h-4 w-4 rounded-full bg-indigo-600" />
              )}
              <span className="text-sm font-medium">{lastSegment}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="amount" className="sr-only">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 text-right"
              />
              <div className="w-16 text-right text-sm text-muted-foreground">
                ${balance?.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Use for lending */}
        {/* <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Use for lending</span>
            </div>
            <Switch checked={useLending} onCheckedChange={setUseLending} />
          </div>
          <InfoRow title="Lending APY" right={<span>123.04%</span>} accent />
        </div> */}

        {/* Use as collateral */}
        {/* <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Use as collateral</span>
            </div>
            <Switch
              checked={useCollateral}
              onCheckedChange={setUseCollateral}
            />
          </div>
          <InfoRow
            title="Health factor"
            right={<span className="text-emerald-600 font-medium">18.75</span>}
            accent
          />
        </div> */}

        {/* Warning */}
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="font-semibold text-yellow-800">
            Warning
          </AlertTitle>
          <AlertDescription className="text-sm text-yellow-800">
            Withdrawals and borrowing depend on available supply. If funds are
            fully borrowed, you may not be able to withdraw your full deposit.
            You can also deposit without enabling lending to avoid restrictions.
          </AlertDescription>
        </Alert>

        {/* TX feedback */}
        {txSig && (
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
            Sent tx:{" "}
            <a
              className="underline"
              href={`https://explorer.solana.com/tx/${txSig}?cluster=testnet`}
              target="_blank"
              rel="noreferrer"
            >
              {txSig.slice(0, 4)}…{txSig.slice(-4)}
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full cursor-pointer"
          disabled={!canDeposit}
          onClick={onApproveAndDeposit}
        >
          {busy ? "Processing…" : "Approve and deposit"}
        </Button>
      </CardFooter>
    </Card>
  );
}

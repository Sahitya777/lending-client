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
import { PublicKey } from "@solana/web3.js";

import {
  getConnection,
  fetchSolBalanceSOL,
  buildApproveAndDepositSolTx,
  fetchSplTokenBalance,
  buildDepositSolTx,
} from "@/utils/chain/solana";

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

  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [pubkey, setPubkey] = React.useState<PublicKey | null>(null);

  const icon = getTokenIcon(lastSegment as string);
  const canDeposit = !!pubkey && amount !== "" && Number(amount) > 0 && !busy;

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

  // READ: fetch SOL balance on mount / wallet change
  React.useEffect(() => {
    (async () => {
      if (!pubkey) {
        setBalance(null);
        return;
      }
      try {
        // You can use Dynamic's connection OR your own
        const connection =
          primaryWallet && isSolanaWallet(primaryWallet)
            ? await primaryWallet.getConnection()
            : getConnection();
        const sol = await fetchSolBalanceSOL(pubkey);
        const NATIVE_MINT = new PublicKey(
          "Em9FJok1Bvfcw9JdjUAENUgqRzGKMYHMX9aNQkPG3JkV"
        );

        const bal = await fetchSplTokenBalance(pubkey, NATIVE_MINT);
        console.log("USDC balance:", bal);
        setBalance(sol);
      } catch {
        setBalance(null);
      }
    })();
  }, [pubkey, primaryWallet]);

  // WRITE: wrap SOL -> approve -> deposit

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
      console.log(connection, "connect");
      const { tx } = await buildDepositSolTx({
        owner: pubkey,
        amountSol: value,
        connection: connection as any,
      });
      console.log(tx,'tx')

      const signer = await primaryWallet.getSigner(); // Dynamic’s Solana signer
      const res = await signer.signAndSendTransaction(tx as any);
      const sig = typeof res === "string" ? res : res.signature;
      setTxSig(sig);

      await connection.confirmTransaction(sig, "confirmed");
      setBalance(await fetchSolBalanceSOL(pubkey));
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
                    {balance === null ? "…" : balance.toFixed(4)} SOL
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

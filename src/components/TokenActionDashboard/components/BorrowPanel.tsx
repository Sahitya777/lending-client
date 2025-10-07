import { getTokenIcon } from "@/utils/helper";
import { usePathname } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import React from "react";
import Image from "next/image";
import { AlertTriangle, Lock, Shield, Coins } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export default function BorrowPanel({lastSegment}:{lastSegment:string |undefined}) {
  const [amount, setAmount] = React.useState("");
  const [useLending, setUseLending] = React.useState(true);
  const [useCollateral, setUseCollateral] = React.useState(false);
  const icon = getTokenIcon(lastSegment as string);

  const canDeposit = amount !== "" && Number(amount) > 0;

  return (
    <Card className="w-full max-w-xl rounded-lg border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Borrow</CardTitle>
          <p className="text-xs text-muted-foreground">
            Max available to borrow{" "}
            <span className="font-semibold">0.0000 {lastSegment}</span>
            &nbsp; <span className="text-muted-foreground/60">Max</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Token + Amount */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              {icon ? (
                <Image src={icon} alt={"logo"} height={18} width={18} />
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
                $0.00
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <InfoRow
            title="Health factor"
            right={<span className="text-emerald-600 font-medium">18.75</span>}
            accent
          />
        </div>

        {/* Warning */}
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="font-semibold text-yellow-800">
            Warning
          </AlertTitle>
          <AlertDescription className="text-sm text-yellow-800">
            Withdrawals and borrowing depend on available supply. If funds are
            fully borrowed, you may not be able to withdraw your full deposit.
            Before proceeding, check liquidity to ensure you can access the
            amount you need. You can also deposit without enabling lending to
            avoid withdrawal restrictions.
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter>
        <Button className="w-full" disabled={!canDeposit}>
          Approve and deposit
        </Button>
      </CardFooter>
    </Card>
  );
}

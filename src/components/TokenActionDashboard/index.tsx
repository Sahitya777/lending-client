"use client";
import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { usePathname } from "next/navigation";
import DepositPanel from "./components/DepositPanel";
import WithdrawPanel from "./components/WithdrawPanel";
import BorrowPanel from "./components/BorrowPanel";
import RepayPanel from "./components/RepayPanel";

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

const PlaceholderPanel = ({ title }: { title: string }) => (
  <Card className="w-full max-w-xl rounded-2xl">
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground">
      Coming soon. Hook your {title.toLowerCase()} logic here.
    </CardContent>
  </Card>
);

const TokenActionDashboard: React.FC = () => {
    const pathname = usePathname(); // "/lend-borrow/BTC"
    const lastSegment = pathname.split("/").filter(Boolean).pop();
  return (
    <div className="min-h-screen w-full bg-muted/10 py-12">
      <div className="mx-auto w-full max-w-3xl px-4">
        {/* Tabs header */}
        <Tabs defaultValue="deposit" className="w-full">
          <div className="flex justify-center">
            <TabsList
              className="
                grid grid-cols-5 gap-2
                rounded-2xl bg-transparent p-1
                sm:w-[560px]
              "
            >
              {[
                ["deposit", "Deposit"],
                ["withdraw", "Withdraw"],
                ["borrow", "Borrow"],
                ["repay", "Repay"],
              ].map(([val, label]) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="
                    data-[state=active]:bg-foreground data-[state=active]:text-background cursor-pointer
                    rounded-lg px-4 py-2 text-sm font-medium
                    bg-white shadow-sm hover:bg-accent/60
                  "
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Panels */}
          <div className="mt-6 flex justify-center">
            <TabsContent value="deposit" className="w-full flex justify-center">
              <DepositPanel lastSegment={lastSegment} />
            </TabsContent>

            <TabsContent
              value="withdraw"
              className="w-full flex justify-center"
            >
              <WithdrawPanel lastSegment={lastSegment}/>
            </TabsContent>

            <TabsContent value="borrow" className="w-full flex justify-center">
              <BorrowPanel lastSegment={lastSegment}/>
            </TabsContent>

            <TabsContent value="repay" className="w-full flex justify-center">
              <RepayPanel lastSegment={lastSegment} />
            </TabsContent>

            <TabsContent value="adjust" className="w-full flex justify-center">
              <PlaceholderPanel title="Adjust" />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default TokenActionDashboard;

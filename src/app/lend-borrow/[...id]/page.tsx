import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import TokenActionDashboard from "@/components/TokenActionDashboard";
import React from "react";

const page = () => {
    return (
    <div>
      <Navbar />
      <div className="flex gap-8">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
            <TokenActionDashboard/>
        </main>
      </div>
    </div>
  );
};

export default page;

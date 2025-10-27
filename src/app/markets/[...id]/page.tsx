import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import TokenActionDashboard from "@/components/TokenActionDashboard";
import React from "react";

const page = () => {
    return (
    <div className="bg-[#F8F8F8]">
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <Navbar/>
            <TokenActionDashboard/>
        </main>
      </div>
    </div>
  );
};

export default page;

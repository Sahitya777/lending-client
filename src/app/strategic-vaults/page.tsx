import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import VaultDashboard from "@/components/VaultsDashboard";
import React, { useState } from "react";

const page = () => {

  return (
    <div>
      {/* <Navbar /> */}
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <Navbar/>
          <VaultDashboard/>
        </main>
      </div>
    </div>
  );
};

export default page;

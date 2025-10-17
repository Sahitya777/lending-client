'use client'
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import React from "react";

const page = () => {
  const createMultipassLink = async (templateId: string) => {
    try {
      const response = await fetch(`https://mobile-api.opacity.network/api/app-links/create`, {
      method: "POST",
      headers: {
      "Content-Type": "application/json",
      },
      body: JSON.stringify({
      apiKey: process.env.NEXT_PBULIC_LUMANLABS_KEY,
      templateId: templateId,
      // flowParams: [], // Only required for flows that need parameters
      }),
      });
      const data = await response.json();
      console.log("Multipass URL:", data.url);
      return data.url;
    } catch (error) {
      console.error("Failed to create Multipass link:", error);
    }
  };

  return (
    <div>
      {/* <Navbar /> */}
      <div className="flex gap-8">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
          <div onClick={()=>{
            createMultipassLink('04a6b0d9-65bc-4588-a0ad-c9f006e198eb')
          }}>
            Url
          </div>
        </main>
      </div>
    </div>
  );
};

export default page;

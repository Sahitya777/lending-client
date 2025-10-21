"use client";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import React, { useState } from "react";

const page = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCreateLink = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error:", error);
      setMessage("An error occurred while creating the link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* <Navbar /> */}
      <div className="flex gap-8">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
          <div
            onClick={() => {
              handleCreateLink();
            }}
          >
            Url
          </div>
        </main>
      </div>
    </div>
  );
};

export default page;

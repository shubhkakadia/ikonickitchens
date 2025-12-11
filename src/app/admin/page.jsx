"use client";
import React from "react";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import Sidebar from "@/components/sidebar";

export default function page() {
  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
        </div>
      </div>
    </AdminRoute>
  );
}

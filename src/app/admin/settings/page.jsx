"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";

export default function page() {
  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="h-full w-full">
            <div className="p-4">
              <h1 className="text-2xl font-bold text-slate-600">
                Settings Page
              </h1>
              <p className="text-slate-500">This is the settings page</p>
            </div>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}

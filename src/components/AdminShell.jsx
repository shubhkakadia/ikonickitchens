"use client";

import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";

export default function AdminShell({ children }) {
    return (
        <AdminRoute>
            <div className="flex h-screen bg-tertiary">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <CRMLayout />
                    <div className="flex-1 overflow-hidden">{children}</div>
                </div>
            </div>
        </AdminRoute>
    );
}



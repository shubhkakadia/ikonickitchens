"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export default function ActivityItem({ activity, index }) {
  const getActivityIcon = (type) => {
    switch (type) {
      case "project":
        return "📁";
      case "client":
        return "👤";
      case "order":
        return "📦";
      case "invoice":
        return "💳";
      default:
        return "📌";
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case "project":
        return "bg-blue-100 text-blue-600";
      case "client":
        return "bg-emerald-100 text-emerald-600";
      case "order":
        return "bg-orange-100 text-orange-600";
      case "invoice":
        return "bg-purple-100 text-purple-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-xl ${getActivityColor(activity.type)} flex items-center justify-center text-lg flex-shrink-0`}>
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{activity.message}</p>
        <p className="text-xs text-slate-500 mt-1">
          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}


"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";

export default function KPICard({ title, value, change, changeType, icon: Icon, iconColor, delay = 0 }) {
  const isPositive = changeType === "positive";
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconColor} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${iconColor.replace("text-", "text-").replace("/10", "")}`} />
        </div>
        {change !== null && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
              isPositive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            <ChangeIcon className="w-3 h-3" />
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {change !== null && (
          <p className={`text-xs mt-2 flex items-center gap-1 ${
            isPositive ? "text-emerald-600" : "text-red-600"
          }`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {isPositive ? "Increase" : "Decrease"} from last month
          </p>
        )}
      </div>
    </motion.div>
  );
}


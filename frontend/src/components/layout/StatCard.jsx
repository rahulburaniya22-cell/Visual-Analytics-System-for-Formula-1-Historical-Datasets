import React from "react";
import { motion } from "framer-motion";

export default function StatCard({ label, value, subtext }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] rounded-lg p-5 flex flex-col gap-1"
    >
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value ?? "—"}
      </span>
      {subtext && <span className="text-xs text-gray-500">{subtext}</span>}
    </motion.div>
  );
}

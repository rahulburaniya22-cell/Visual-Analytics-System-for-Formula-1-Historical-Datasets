import React from "react";

export default function LoadingSkeleton({ height = "400px" }) {
  return (
    <div
      className="bg-[#111111] rounded-lg animate-pulse flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-gray-500 text-sm">Loading data...</div>
    </div>
  );
}

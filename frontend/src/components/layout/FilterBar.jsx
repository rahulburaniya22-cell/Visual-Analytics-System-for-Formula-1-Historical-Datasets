import React from "react";
import useFilterStore from "../../store/filterStore";

const seasons = Array.from({ length: 25 }, (_, i) => 2024 - i);

export default function FilterBar() {
  const { season, setSeason } = useFilterStore();

  return (
    <div className="bg-[#111111] border-b border-[#222] px-6 py-3 flex items-center gap-4">
      <label className="text-sm text-gray-400">Season</label>
      <select
        value={season}
        onChange={(e) => setSeason(Number(e.target.value))}
        className="bg-[#1a1a1a] text-white border border-[#333] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#e10600]"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

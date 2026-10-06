import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getTeamColor } from "../../constants/f1Colors";

const SLOT_COUNT = 7;

export default function ChampionshipChart({ data }) {
  const { pivoted, rankedDrivers, driverConstructor } = useMemo(() => {
    const driverConstructor = new Map();
    const driverSet = new Set();
    for (const row of data) {
      driverSet.add(row.driver);
      if (!driverConstructor.has(row.driver)) {
        driverConstructor.set(row.driver, row.team || row.constructor);
      }
    }

    // Rank drivers by final cumulative points (descending)
    const maxRound = Math.max(...data.map((r) => r.round));
    const finalPoints = new Map();
    for (const row of data) {
      if (row.round === maxRound) {
        finalPoints.set(row.driver, row.cumulative_points || 0);
      }
    }
    const rankedDrivers = Array.from(driverSet).sort(
      (a, b) => (finalPoints.get(b) || 0) - (finalPoints.get(a) || 0)
    );

    const byRound = new Map();
    for (const row of data) {
      if (!byRound.has(row.round)) byRound.set(row.round, { round: row.round });
      byRound.get(row.round)[row.driver] = row.cumulative_points;
    }
    const pivoted = Array.from(byRound.values()).sort((a, b) => a.round - b.round);

    return { pivoted, rankedDrivers, driverConstructor };
  }, [data]);

  // Slots: top 7 by default
  const [slots, setSlots] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(null); // index of slot being swapped
  const pickerRef = useRef(null);

  // Reset slots when data changes
  useEffect(() => {
    setSlots(rankedDrivers.slice(0, SLOT_COUNT));
    setPickerOpen(null);
  }, [rankedDrivers]);

  // Close picker on outside click / escape
  useEffect(() => {
    if (pickerOpen === null) return;
    function onClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(null);
    }
    function onEscape(e) {
      if (e.key === "Escape") setPickerOpen(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [pickerOpen]);

  const swapDriver = useCallback((slotIndex, newDriver) => {
    setSlots((prev) => {
      const next = [...prev];
      const oldDriver = next[slotIndex];
      const existingIndex = next.indexOf(newDriver);
      if (existingIndex !== -1 && existingIndex !== slotIndex) {
        next[existingIndex] = oldDriver;
      }
      next[slotIndex] = newDriver;
      return next;
    });
    setPickerOpen(null);
  }, []);

  function formatLabel(driver) {
    return driver
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  return (
    <div className="bg-[#111111] border border-zinc-800 rounded-lg p-4 w-full text-white">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 tracking-wide uppercase">
        Championship Progression
      </h3>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={pivoted} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-800" />
          <XAxis
            dataKey="round"
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            label={{ value: "Round", position: "insideBottom", offset: -3, fill: "#71717a" }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            label={{ value: "Cumulative Points", angle: -90, position: "insideLeft", fill: "#71717a" }}
          />
          <Tooltip content={<ChampionshipTooltip formatLabel={formatLabel} />} />
          {slots.map((driver) => {
            const color = getTeamColor(driverConstructor.get(driver));
            return (
              <Line
                key={driver}
                type="monotone"
                dataKey={driver}
                name={driver}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Driver slot chips — click to swap */}
      <div className="relative">
        <p className="text-[11px] text-gray-500 mt-3 mb-2">
          Showing {slots.length} of {rankedDrivers.length} drivers. Click a name to swap.
        </p>
        <div className="flex flex-wrap gap-2">
          {slots.map((driver, i) => {
            const color = getTeamColor(driverConstructor.get(driver));
            return (
              <button
                key={driver}
                onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border transition-all cursor-pointer ${
                  pickerOpen === i
                    ? "border-[#e10600] text-white bg-[#e10600]/10"
                    : "border-zinc-700 text-gray-200 hover:border-gray-500"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: color }}
                />
                {formatLabel(driver)}
              </button>
            );
          })}
        </div>

        {/* Dropdown picker */}
        {pickerOpen !== null && (
          <div
            ref={pickerRef}
            className="absolute z-30 w-56 max-h-72 overflow-auto rounded-lg border border-white/15 bg-[#0d0d0d]/95 backdrop-blur-sm shadow-2xl shadow-black/60 py-1 bottom-full mb-2"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-white/10">
              Swap {formatLabel(slots[pickerOpen])} for...
            </div>
            {rankedDrivers.map((driver) => {
              const onChart = slots.includes(driver);
              const isSelf = driver === slots[pickerOpen];
              const color = getTeamColor(driverConstructor.get(driver));
              return (
                <button
                  key={driver}
                  type="button"
                  disabled={isSelf}
                  onClick={() => swapDriver(pickerOpen, driver)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent ${
                    isSelf ? "text-gray-500" : "text-gray-200"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">{formatLabel(driver)}</span>
                  {isSelf ? (
                    <span className="ml-auto text-[9px] text-gray-600 tracking-wide">CURRENT</span>
                  ) : onChart ? (
                    <span className="ml-auto text-[9px] font-semibold text-[#e10600] tracking-wide">SWAP</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChampionshipTooltip({ active, payload, label, formatLabel }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => p.value != null)
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 shadow-xl max-h-64 overflow-y-auto">
      <div className="text-xs font-semibold text-gray-300 mb-1">Round {label}</div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.dataKey} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: row.stroke }}
            />
            <span className="text-gray-200">{formatLabel(row.dataKey)}</span>
            <span className="text-gray-500 ml-auto tabular-nums">{row.value} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

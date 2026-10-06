import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getTeamColor } from "../../constants/f1Colors";

export default function EraBumpChart({ data, constructorData = null }) {
  const [viewMode, setViewMode] = useState("drivers");
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const chartWrapRef = useRef(null);

  const seasons = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.season))).sort((a, b) => a - b);
  }, [data]);

  const minSeason = seasons[0] || 2000;
  const maxSeason = seasons[seasons.length - 1] || 2024;
  const totalSpan = maxSeason - minSeason;

  // Zoom/pan state: viewStart and viewEnd define the visible season range
  const [viewStart, setViewStart] = useState(minSeason);
  const [viewEnd, setViewEnd] = useState(maxSeason);

  // Drag state
  const dragRef = useRef(null);

  // Reset view when seasons change
  useEffect(() => {
    setViewStart(minSeason);
    setViewEnd(maxSeason);
  }, [minSeason, maxSeason]);

  // Zoom via scroll wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const currentSpan = viewEnd - viewStart;
    const minSpan = 3; // minimum 3 seasons visible

    // Get mouse position relative to chart for zoom-toward-cursor
    const rect = chartWrapRef.current?.getBoundingClientRect();
    const mouseRatio = rect ? (e.clientX - rect.left) / rect.width : 0.5;

    let delta = e.deltaY > 0 ? zoomFactor : -zoomFactor; // scroll down = zoom out
    let newSpan = currentSpan * (1 + delta);
    newSpan = Math.max(minSpan, Math.min(totalSpan, newSpan));

    const spanChange = newSpan - currentSpan;
    let newStart = viewStart - spanChange * mouseRatio;
    let newEnd = newStart + newSpan;

    // Clamp
    if (newStart < minSeason) { newStart = minSeason; newEnd = newStart + newSpan; }
    if (newEnd > maxSeason) { newEnd = maxSeason; newStart = newEnd - newSpan; }
    newStart = Math.max(minSeason, newStart);
    newEnd = Math.min(maxSeason, newEnd);

    setViewStart(newStart);
    setViewEnd(newEnd);
  }, [viewStart, viewEnd, minSeason, maxSeason, totalSpan]);

  // Attach wheel listener (non-passive to allow preventDefault)
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Drag to pan
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const rect = chartWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      viewStart,
      viewEnd,
      width: rect.width,
    };
    e.preventDefault();
  }, [viewStart, viewEnd]);

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return;
      const { startX, viewStart: vs, viewEnd: ve, width } = dragRef.current;
      const dx = e.clientX - startX;
      const span = ve - vs;
      const seasonsPerPx = span / width;
      let shift = -dx * seasonsPerPx;

      let newStart = vs + shift;
      let newEnd = ve + shift;
      if (newStart < minSeason) { newStart = minSeason; newEnd = minSeason + span; }
      if (newEnd > maxSeason) { newEnd = maxSeason; newStart = maxSeason - span; }

      setViewStart(newStart);
      setViewEnd(newEnd);
    }
    function onUp() {
      dragRef.current = null;
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [minSeason, maxSeason]);

  // Double-click to reset zoom
  const handleDoubleClick = useCallback(() => {
    setViewStart(minSeason);
    setViewEnd(maxSeason);
  }, [minSeason, maxSeason]);

  // Compute visible seasons for data filtering
  const visibleSeasons = useMemo(() => {
    return seasons.filter((s) => s >= Math.floor(viewStart) && s <= Math.ceil(viewEnd));
  }, [seasons, viewStart, viewEnd]);

  const driverLatestTeam = useMemo(() => {
    const map = new Map();
    for (const row of [...data].sort((a, b) => a.season - b.season)) {
      map.set(row.driver, row.team);
    }
    return map;
  }, [data]);

  const derivedConstructorRanks = useMemo(() => {
    if (constructorData) return constructorData;
    const bySeasonTeam = new Map();
    for (const row of data) {
      const key = `${row.season}__${row.team}`;
      if (!bySeasonTeam.has(key)) {
        bySeasonTeam.set(key, { season: row.season, team: row.team, positions: [] });
      }
      bySeasonTeam.get(key).positions.push(row.position);
    }
    const bySeason = new Map();
    for (const entry of bySeasonTeam.values()) {
      const avg = entry.positions.reduce((a, b) => a + b, 0) / entry.positions.length;
      if (!bySeason.has(entry.season)) bySeason.set(entry.season, []);
      bySeason.get(entry.season).push({ team: entry.team, avg });
    }
    const rows = [];
    for (const [season, teams] of bySeason.entries()) {
      const ranked = [...teams].sort((a, b) => a.avg - b.avg);
      ranked.forEach((t, idx) => {
        rows.push({ season, team: t.team, position: idx + 1 });
      });
    }
    return rows;
  }, [data, constructorData]);

  const activeRows = viewMode === "drivers" ? data : derivedConstructorRanks;
  const entityField = viewMode === "drivers" ? "driver" : "team";

  const entities = useMemo(
    () => Array.from(new Set(activeRows.map((r) => r[entityField]))).sort(),
    [activeRows, entityField]
  );

  const pivoted = useMemo(() => {
    const visibleSet = new Set(visibleSeasons);
    const bySeason = new Map();
    for (const season of visibleSeasons) bySeason.set(season, { season });
    for (const row of activeRows) {
      if (visibleSet.has(row.season)) {
        bySeason.get(row.season)[row[entityField]] = row.position;
      }
    }
    return Array.from(bySeason.values());
  }, [activeRows, visibleSeasons, entityField]);

  const maxPosition = useMemo(
    () => Math.max(...activeRows.map((r) => r.position), 10),
    [activeRows]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function toggleEntity(entity) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(entity) ? next.delete(entity) : next.add(entity);
      return next;
    });
  }

  function switchMode(mode) {
    setViewMode(mode);
    setSelected(new Set());
    setSearch("");
  }

  function formatLabel(entity) {
    if (viewMode === "constructors") return entity;
    return entity
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  function entityColor(entity) {
    const team = viewMode === "drivers" ? driverLatestTeam.get(entity) : entity;
    return getTeamColor(team);
  }

  const filteredEntities = entities.filter((e) =>
    formatLabel(e).toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = selected.size > 0;
  const isZoomed = (viewEnd - viewStart) < totalSpan - 0.5;

  return (
    <div className="bg-[#111111] border border-zinc-800 rounded-lg p-4 w-full text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-300 tracking-wide uppercase">
          Era Progression · {seasons[0]}–{seasons[seasons.length - 1]}
        </h3>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-md border border-zinc-800 overflow-hidden">
            <button
              onClick={() => switchMode("drivers")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "drivers"
                  ? "bg-[#e10600] text-white"
                  : "bg-[#0a0a0a] text-gray-400 hover:text-white"
              }`}
            >
              View Drivers
            </button>
            <button
              onClick={() => switchMode("constructors")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-zinc-800 cursor-pointer ${
                viewMode === "constructors"
                  ? "bg-[#e10600] text-white"
                  : "bg-[#0a0a0a] text-gray-400 hover:text-white"
              }`}
            >
              View Constructors
            </button>
          </div>

          {/* Multi-select filter dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-800 bg-[#0a0a0a] text-gray-300 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
            >
              {hasSelection ? `${selected.size} selected` : "Select entities"} ▾
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-[#0a0a0a] border border-zinc-800 rounded-md shadow-xl z-20 p-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${viewMode}...`}
                  className="w-full mb-2 px-2 py-1.5 text-xs bg-[#111111] border border-zinc-800 rounded text-white placeholder-gray-500 focus:outline-none focus:border-zinc-600"
                />
                <div className="flex justify-between mb-2 px-1">
                  <button
                    onClick={() => setSelected(new Set(entities))}
                    className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                {filteredEntities.map((entity) => (
                  <label
                    key={entity}
                    className="flex items-center gap-2 px-1 py-1 text-xs text-gray-200 hover:bg-zinc-900 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entity)}
                      onChange={() => toggleEntity(entity)}
                      className="accent-[#e10600]"
                    />
                    <span
                      className="w-2 h-2 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: entityColor(entity) }}
                    />
                    {formatLabel(entity)}
                  </label>
                ))}
                {filteredEntities.length === 0 && (
                  <div className="text-xs text-gray-500 px-1 py-2">No matches</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart — zoom via scroll, pan via drag, double-click to reset */}
      <div
        ref={chartWrapRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: dragRef.current ? "grabbing" : "grab", userSelect: "none" }}
      >
        {hasSelection ? (
          <ResponsiveContainer width="100%" height={440}>
            <LineChart data={pivoted} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-800" />
              <XAxis
                dataKey="season"
                type="number"
                domain={[Math.floor(viewStart), Math.ceil(viewEnd)]}
                ticks={visibleSeasons}
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                label={{ value: "Season", position: "insideBottom", offset: -3, fill: "#71717a" }}
              />
              <YAxis
                reversed
                type="number"
                domain={[1, maxPosition]}
                allowDecimals={false}
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                label={{ value: "Championship Position", angle: -90, position: "insideLeft", fill: "#71717a" }}
              />
              <Tooltip content={<BumpTooltip formatLabel={formatLabel} />} />
              {entities.map((entity) => {
                if (!selected.has(entity)) return null;
                const color = entityColor(entity);
                return (
                  <Line
                    key={entity}
                    type="linear"
                    dataKey={entity}
                    name={entity}
                    stroke={color}
                    strokeWidth={2.5}
                    strokeOpacity={1}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[440px] border border-dashed border-zinc-800 rounded-lg">
            <span className="text-gray-500 text-sm">Select entities above to display the chart</span>
          </div>
        )}
      </div>

      {/* Zoom hint */}
      <p className="text-[10px] text-gray-500 text-center mt-2">
        Scroll to zoom · Drag to pan · Double-click to reset
        {isZoomed && (
          <span className="ml-2 text-[#e10600]">
            · Viewing {Math.floor(viewStart)}–{Math.ceil(viewEnd)}
          </span>
        )}
      </p>
    </div>
  );
}

function BumpTooltip({ active, payload, label, formatLabel }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => p.value != null)
    .sort((a, b) => a.value - b.value);
  if (rows.length === 0) return null;

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 shadow-xl">
      <div className="text-xs font-semibold text-gray-300 mb-1">Season {label}</div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.dataKey} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: row.stroke }}
            />
            <span className="text-gray-200">{formatLabel(row.dataKey)}</span>
            <span className="text-gray-500 ml-auto">P{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

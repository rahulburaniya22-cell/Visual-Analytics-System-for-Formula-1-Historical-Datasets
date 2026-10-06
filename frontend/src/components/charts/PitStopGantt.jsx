import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { getTeamColor, COMPOUND_COLORS } from "../../constants/f1Colors";
import { getPitStopGanttData, getPositionChartData } from "../../lib/queries";
import SlotDriverPicker from "../SlotDriverPicker";
import LoadingSkeleton from "../layout/LoadingSkeleton";
import useViewModeStore from "../../store/viewModeStore";

const SLOT_COUNT = 5;

function tireColor(compound) {
  return COMPOUND_COLORS[compound] || "#B6BABD";
}

/**
 * PitStopGantt
 * Gantt-style chart of tire stints. Y = drivers (sorted by race position),
 * X = lap number. Drivers move up/down as their position changes during playback.
 * Props: { raceId: string }
 */
export default function PitStopGantt({ raceId }) {
  const { isMobileView } = useViewModeStore();
  const rowHeight = 34;
  const margin = { top: 24, right: 24, bottom: 40, left: 100 };

  const [data, setData] = useState([]);
  const [positionData, setPositionData] = useState([]);
  const [driverTeams, setDriverTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [currentLap, setCurrentLap] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [slots, setSlots] = useState([]);
  const [picker, setPicker] = useState(null);
  const [width, setWidth] = useState(900);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);

  // Mobile view only: track container width so the chart adapts (keeps text
  // at a legible fixed pixel size instead of visually shrinking the whole SVG).
  // Desktop keeps the original fixed 900px chart.
  useEffect(() => {
    if (!isMobileView) { setWidth(900); return; }
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, el.clientWidth - 32));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobileView]);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPitStopGanttData(raceId),
      getPositionChartData(raceId),
    ]).then(([stints, laps]) => {
      setData(stints);
      setPositionData(laps);
      const teams = {};
      laps.forEach(l => { if (!teams[l.driver]) teams[l.driver] = l.team; });
      setDriverTeams(teams);
      setLoading(false);
    });
  }, [raceId]);

  // Build a lookup: { driver -> { lap -> position } }
  const positionByDriverLap = useMemo(() => {
    const map = {};
    positionData.forEach(row => {
      const lap = row.lap_number || row.lap;
      if (!map[row.driver]) map[row.driver] = {};
      map[row.driver][lap] = row.position;
    });
    return map;
  }, [positionData]);

  const { allDrivers, minLap, maxLap, xScale, innerWidth } = useMemo(() => {
    if (!data || data.length === 0) {
      return { allDrivers: [], minLap: 0, maxLap: 0, xScale: d3.scaleLinear(), innerWidth: 0 };
    }
    const driverList = Array.from(new Set(data.map((d) => d.driver)));
    const lapMin = d3.min(data, (d) => d.start_lap);
    const lapMax = d3.max(data, (d) => d.end_lap);
    // Sort by final race position (last lap with position data)
    driverList.sort((a, b) => {
      const getFinishPos = (driver) => {
        const positions = positionByDriverLap[driver];
        if (!positions) return 999;
        for (let l = lapMax; l >= lapMin; l--) {
          if (positions[l] != null) return positions[l];
        }
        return 999;
      };
      return getFinishPos(a) - getFinishPos(b);
    });
    const iW = width - margin.left - margin.right;
    const xS = d3.scaleLinear().domain([lapMin, lapMax]).range([0, iW]);
    return { allDrivers: driverList, minLap: lapMin, maxLap: lapMax, xScale: xS, innerWidth: iW };
  }, [data, width, positionByDriverLap]);

  const driverMeta = useMemo(() => {
    const map = {};
    allDrivers.forEach((d) => { map[d] = { team: driverTeams[d] }; });
    return map;
  }, [allDrivers, driverTeams]);

  const innerHeight = slots.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  // Reset slots on new data — pick top finishers by default
  useEffect(() => {
    if (!allDrivers || allDrivers.length === 0) { setSlots([]); return; }
    setSlots(allDrivers.slice(0, SLOT_COUNT));
    setPicker(null);
  }, [allDrivers]);

  useEffect(() => {
    setCurrentLap(maxLap || null);
    setIsPlaying(false);
  }, [minLap, maxLap]);

  // Animation
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentLap((prev) => {
          if (prev === null) return minLap;
          if (prev >= maxLap) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 180);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, minLap, maxLap]);

  const togglePlay = useCallback(() => {
    if (currentLap !== null && currentLap >= maxLap) setCurrentLap(minLap);
    setIsPlaying((p) => !p);
  }, [currentLap, maxLap, minLap]);

  const handleScrub = useCallback((e) => {
    setIsPlaying(false);
    setCurrentLap(Number(e.target.value));
  }, []);

  const handleEnter = useCallback((stint, evt) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered({ stint, x: evt.clientX - (rect?.left ?? 0), y: evt.clientY - (rect?.top ?? 0) });
  }, []);

  const handleMove = useCallback((evt) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered((prev) => prev ? { ...prev, x: evt.clientX - (rect?.left ?? 0), y: evt.clientY - (rect?.top ?? 0) } : prev);
  }, []);

  const handleLeave = useCallback(() => setHovered(null), []);

  const swapDriverIntoSlot = useCallback((slotIndex, newDriver) => {
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
    setPicker(null);
  }, []);

  // Sort slots by position at current lap
  const sortedSlots = useMemo(() => {
    const visibleLap = currentLap ?? maxLap;
    return [...slots].sort((a, b) => {
      // Find closest lap with position data at or before visibleLap
      const getPos = (driver) => {
        const positions = positionByDriverLap[driver];
        if (!positions) return 999;
        // Try exact lap first
        if (positions[visibleLap] != null) return positions[visibleLap];
        // Fallback: find closest prior lap
        for (let l = visibleLap; l >= minLap; l--) {
          if (positions[l] != null) return positions[l];
        }
        return 999;
      };
      return getPos(a) - getPos(b);
    });
  }, [slots, currentLap, maxLap, minLap, positionByDriverLap]);

  // Map each driver to its target Y position for smooth animation
  const driverYMap = useMemo(() => {
    const map = {};
    sortedSlots.forEach((driver, i) => {
      map[driver] = i * rowHeight;
    });
    return map;
  }, [sortedSlots, rowHeight]);

  if (loading) return <LoadingSkeleton height="300px" />;
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">No stint data available for this race</div>;
  }

  const visibleLap = currentLap ?? maxLap;

  // Get position label for a driver at current lap
  const getPositionLabel = (driver) => {
    const positions = positionByDriverLap[driver];
    if (!positions) return "";
    if (positions[visibleLap] != null) return `P${positions[visibleLap]}`;
    for (let l = visibleLap; l >= minLap; l--) {
      if (positions[l] != null) return `P${positions[l]}`;
    }
    return "";
  };

  return (
    <div ref={containerRef} className="relative bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
      {/* Playback controls */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={togglePlay}
          className="px-3 py-1 rounded bg-[#e10600] hover:bg-[#ff1a12] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
        >
          {isPlaying ? "PAUSE" : visibleLap >= maxLap ? "REPLAY" : "PLAY"}
        </button>
        <input
          type="range" min={minLap} max={maxLap} value={visibleLap}
          onChange={handleScrub}
          className="flex-1 accent-[#e10600]"
        />
        <span className="text-xs text-gray-300 font-mono w-16 text-right">
          Lap {visibleLap}/{maxLap}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Showing {slots.length} of {allDrivers.length} drivers — sorted by race position. Click a name to swap.
      </p>

      <svg width={width} height={height} className="overflow-visible max-w-full">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <defs>
            <clipPath id="pitstop-gantt-clip">
              <rect x={-4} y={-10} width={xScale(visibleLap) + 4} height={innerHeight + 20} />
            </clipPath>
          </defs>

          {xScale.ticks(Math.min(10, maxLap - minLap)).map((t) => (
            <g key={t}>
              <line x1={xScale(t)} x2={xScale(t)} y1={0} y2={innerHeight} stroke="#ffffff" strokeOpacity={0.06} />
              <text x={xScale(t)} y={innerHeight + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">
                {Math.round(t)}
              </text>
            </g>
          ))}
          <text x={innerWidth / 2} y={innerHeight + 32} textAnchor="middle" fontSize={11} fill="#6b7280">Lap</text>

          {/* Row divider lines (static positions) */}
          {sortedSlots.map((_, i) => (
            <line key={`line-${i}`} x1={0} x2={innerWidth} y1={(i + 1) * rowHeight} y2={(i + 1) * rowHeight} stroke="#ffffff" strokeOpacity={0.06} />
          ))}

          {/* Driver rows — animated Y position */}
          {slots.map((driver) => {
            const y = driverYMap[driver] ?? 0;
            const slotIndex = sortedSlots.indexOf(driver);
            const stints = data.filter((d) => d.driver === driver).sort((a, b) => a.stint_number - b.stint_number);
            const labelColor = getTeamColor(driverTeams[driver]);
            const posLabel = getPositionLabel(driver);

            return (
              <g key={driver} style={{ transform: `translateY(${y}px)`, transition: "transform 0.35s ease" }}>
                {/* Position badge */}
                <text
                  x={-88} y={rowHeight / 2} dy="0.32em" textAnchor="start"
                  fontSize={9} fontWeight={700} fill="#6b7280"
                >
                  {posLabel}
                </text>
                {/* Driver name (surname only) */}
                <text
                  x={-10} y={rowHeight / 2} dy="0.32em" textAnchor="end"
                  fontSize={11} fontWeight={600} fill={labelColor}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setPicker({ slotIndex, driver, x: margin.left, y: margin.top + y + rowHeight / 2 }); }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  {driver.includes("_") ? driver.split("_").pop() : driver}
                </text>

                <g clipPath="url(#pitstop-gantt-clip)">
                  {stints.map((stint) => {
                    const barX = xScale(stint.start_lap);
                    const barW = Math.max(2, xScale(stint.end_lap) - xScale(stint.start_lap));
                    const color = tireColor(stint.compound);
                    const isHovered = hovered?.stint === stint;

                    // Compute stint % of race completed so far for this driver
                    const lapsOnThisStint = Math.max(0, Math.min(visibleLap, stint.end_lap) - stint.start_lap + 1);
                    const stintActive = visibleLap >= stint.start_lap;
                    const totalLapsCompleted = Math.max(1, visibleLap - stints[0].start_lap + 1);
                    const pct = stintActive ? Math.round((lapsOnThisStint / totalLapsCompleted) * 100) : 0;
                    const showPct = stintActive && barW > 28;

                    return (
                      <g key={stint.stint_number}>
                        <rect
                          x={barX} y={6} width={barW} height={rowHeight - 12} rx={3}
                          fill={color}
                          stroke={isHovered ? "#ffffff" : "rgba(0,0,0,0.35)"}
                          strokeWidth={isHovered ? 1.5 : 1}
                          opacity={hovered && !isHovered ? 0.55 : 1}
                          style={{ cursor: "pointer", transition: "opacity 120ms ease" }}
                          onMouseEnter={(e) => handleEnter(stint, e)}
                          onMouseMove={handleMove}
                          onMouseLeave={handleLeave}
                        />
                        {showPct && (
                          <text
                            x={barX + barW / 2} y={rowHeight / 2} dy="0.35em"
                            textAnchor="middle" fontSize={9} fontWeight={700}
                            fill="#000000" fillOpacity={0.7}
                            style={{ pointerEvents: "none" }}
                          >
                            {pct}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {(() => {
                  const activeStint = stints.find(s => visibleLap >= s.start_lap && visibleLap <= s.end_lap);
                  if (!activeStint || visibleLap >= maxLap) return null;
                  return <circle cx={xScale(visibleLap)} cy={rowHeight / 2} r={4} fill="#ffffff" stroke="#0a0a0a" strokeWidth={1.5} />;
                })()}
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div
          className="absolute z-10 pointer-events-none bg-[#111111] border border-white/15 rounded-md px-3 py-2 text-xs text-gray-100 shadow-lg"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <div className="font-semibold" style={{ color: tireColor(hovered.stint.compound) }}>
            {hovered.stint.compound}
          </div>
          <div className="text-gray-400 mt-0.5">
            Laps {hovered.stint.start_lap}–{hovered.stint.end_lap} ({hovered.stint.end_lap - hovered.stint.start_lap + 1} laps)
          </div>
        </div>
      )}

      {picker && (
        <SlotDriverPicker
          picker={picker}
          allDrivers={allDrivers}
          slots={slots}
          driverMeta={driverMeta}
          onPick={(newDriver) => swapDriverIntoSlot(picker.slotIndex, newDriver)}
          onClose={() => setPicker(null)}
        />
      )}

      <div className="flex flex-wrap gap-3 mt-3 px-1">
        {Object.entries(COMPOUND_COLORS).map(([compound, color]) => (
          <div key={compound} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-400 tracking-wide">{compound}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

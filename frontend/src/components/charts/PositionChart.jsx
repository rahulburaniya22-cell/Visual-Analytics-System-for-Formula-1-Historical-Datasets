import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { getTeamColor, COMPOUND_COLORS } from '../../constants/f1Colors';
import { getPositionChartData } from '../../lib/queries';
import LoadingSkeleton from '../layout/LoadingSkeleton';

const MAX_COMPARED_DRIVERS = 5;

/**
 * PositionChart
 * Animated race position chart. X = lap, Y = position (inverted, P1 at top).
 * Shows up to 5 drivers at a time — click chips to swap drivers in/out.
 * Props: { raceId: string }
 */
export default function PositionChart({ raceId }) {
  const svgRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLap, setCurrentLap] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [openSlot, setOpenSlot] = useState(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    getPositionChartData(raceId).then((rows) => {
      // Transform: query returns { driver, team, lap_number, position }
      // Chart expects { driver, team, lap, position, compound, pit_flag }
      const transformed = rows.map(r => ({
        driver: r.driver,
        team: r.team,
        lap: r.lap_number || r.lap,
        position: r.position,
        compound: r.compound || null,
        pit_flag: r.pit_flag || r.pit_in_flag || false,
      }));
      setData(transformed);
      setLoading(false);
    });
  }, [raceId]);

  const allDrivers = useMemo(() => {
    const meta = new Map();
    const bestPos = new Map();
    data.forEach((d) => {
      if (!meta.has(d.driver)) meta.set(d.driver, d.team);
      // Track best (lowest) position per driver across all laps
      const prev = bestPos.get(d.driver) ?? 999;
      if (d.position < prev) bestPos.set(d.driver, d.position);
    });
    // Find last lap to get final race positions
    const maxLapNum = Math.max(...data.map((d) => d.lap));
    const finalPos = new Map();
    data.forEach((d) => {
      if (d.lap === maxLapNum) finalPos.set(d.driver, d.position);
    });
    return Array.from(meta.entries())
      .map(([driver, team]) => ({ driver, team }))
      .sort((a, b) => (finalPos.get(a.driver) ?? 999) - (finalPos.get(b.driver) ?? 999));
  }, [data]);

  const { maxLap, maxPosition } = useMemo(() => {
    if (!data.length) return { maxLap: 1, maxPosition: 1 };
    return {
      maxLap: d3.max(data, d => d.lap) || 1,
      maxPosition: d3.max(data, d => d.position) || 1
    };
  }, [data]);

  // Reset on new data
  useEffect(() => {
    setCurrentLap(1);
    setIsPlaying(false);
    setSelectedDrivers(allDrivers.slice(0, MAX_COMPARED_DRIVERS).map((d) => d.driver));
    setOpenSlot(null);
  }, [data]);

  // Animation
  useEffect(() => {
    let interval;
    if (isPlaying && currentLap < maxLap) {
      interval = setInterval(() => {
        setCurrentLap(prev => prev + 1);
      }, 220);
    } else if (currentLap >= maxLap) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentLap, maxLap]);

  const handleSwapDriver = (slotIndex, newDriver) => {
    setSelectedDrivers((prev) => {
      const next = [...prev];
      next[slotIndex] = newDriver;
      return next;
    });
    setOpenSlot(null);
  };

  // Render D3 Chart
  useEffect(() => {
    if (!data.length || !svgRef.current || !selectedDrivers.length) return;
    d3.select(svgRef.current).selectAll('*').remove();

    const container = svgRef.current.parentElement;
    const containerWidth = container?.clientWidth || 850;

    const margin = { top: 30, right: 70, bottom: 40, left: 40 };
    const width = Math.min(containerWidth - 48, 850) - margin.left - margin.right;
    const dynamicHeight = Math.max(400, maxPosition * 28);
    const height = dynamicHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([1, maxLap]).range([0, width]);
    const y = d3.scaleLinear().domain([maxPosition, 1]).range([height, 0]);

    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(Math.min(maxLap, 20)).tickFormat(d3.format("d")))
      .attr('color', '#888');

    svg.append('g').call(d3.axisLeft(y).ticks(maxPosition))
      .attr('color', '#888');

    const visibleData = data.filter(d => d.lap <= currentLap && selectedDrivers.includes(d.driver));
    const dataByDriver = d3.group(visibleData, d => d.driver);

    const lineGenerator = d3.line()
      .x(d => x(d.lap))
      .y(d => y(d.position))
      .curve(d3.curveMonotoneX);

    const teamCounts = {};
    const labelPlacements = [];

    selectedDrivers.forEach((driverName) => {
      const driverData = dataByDriver.get(driverName);
      if (!driverData || driverData.length === 0) return;

      const team = driverData[0].team || 'Unknown';
      if (!teamCounts[team]) teamCounts[team] = 0;
      teamCounts[team]++;

      const isSecondDriver = teamCounts[team] > 1;
      const teamColor = getTeamColor(team);

      const mainPath = svg.append('path')
        .datum(driverData)
        .attr('fill', 'none')
        .attr('stroke', teamColor)
        .attr('stroke-width', 3)
        .attr('d', lineGenerator);

      if (isSecondDriver) {
        mainPath.attr('stroke-dasharray', '6,6');
      }

      // Compound band
      const compoundLine = d3.line()
        .x(d => x(d.lap))
        .y(d => y(d.position) + 6)
        .curve(d3.curveMonotoneX);

      for (let i = 0; i < driverData.length - 1; i++) {
        const segment = [driverData[i], driverData[i + 1]];
        const compPath = svg.append('path')
          .datum(segment)
          .attr('fill', 'none')
          .attr('stroke', COMPOUND_COLORS[driverData[i].compound] || '#888')
          .attr('stroke-width', 1.5)
          .attr('d', compoundLine);

        if (isSecondDriver) {
          compPath.attr('stroke-dasharray', '3,3');
        }
      }

      // Driver label
      const lastPoint = driverData[driverData.length - 1];
      labelPlacements.push({
        driver: driverName,
        color: teamColor,
        x: x(lastPoint.lap) + 8,
        y: y(lastPoint.position) + 4,
      });

      // Pit stops
      const pitStops = driverData.filter(d => d.pit_flag);
      svg.selectAll(`.pitstop-${driverName}`)
        .data(pitStops)
        .enter().append('circle')
        .attr('cx', d => x(d.lap))
        .attr('cy', d => y(d.position))
        .attr('r', 5)
        .attr('fill', '#0a0a0a')
        .attr('stroke', teamColor)
        .attr('stroke-width', 2);
    });

    // De-overlap labels
    const MIN_LABEL_GAP = 13;
    labelPlacements.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labelPlacements.length; i++) {
      const prev = labelPlacements[i - 1];
      const curr = labelPlacements[i];
      if (curr.y - prev.y < MIN_LABEL_GAP) {
        curr.y = prev.y + MIN_LABEL_GAP;
      }
    }

    svg.selectAll('.driver-label')
      .data(labelPlacements)
      .enter()
      .append('text')
      .attr('class', 'driver-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .text(d => d.driver)
      .style('fill', d => d.color)
      .style('font-size', '11px')
      .style('font-weight', 'bold');

  }, [data, currentLap, maxLap, maxPosition, selectedDrivers]);

  const driverMeta = useMemo(() => {
    const m = new Map();
    allDrivers.forEach((d) => m.set(d.driver, d.team));
    return m;
  }, [allDrivers]);

  if (loading) return <LoadingSkeleton height="450px" />;
  if (!data.length) return <div className="text-gray-500 text-sm text-center py-8">No lap data available for this race</div>;

  return (
    <div className="w-full bg-[#0a0a0a] p-4 rounded-xl border border-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-lg font-semibold tracking-wide uppercase">Race Position Tracker</h2>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-[#e10600] text-white px-4 py-1 rounded font-bold hover:bg-red-700 transition cursor-pointer"
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400">Lap {currentLap} / {maxLap}</span>
            <input
              type="range" min="1" max={maxLap}
              value={currentLap}
              onChange={(e) => { setCurrentLap(Number(e.target.value)); setIsPlaying(false); }}
              className="w-32 cursor-pointer accent-[#e10600]"
            />
          </div>
        </div>
      </div>

      {/* Driver comparison chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selectedDrivers.map((driverCode, slotIndex) => {
          const team = driverMeta.get(driverCode);
          const color = getTeamColor(team);
          const otherDrivers = allDrivers.filter(
            (d) => d.driver === driverCode || !selectedDrivers.includes(d.driver)
          );
          const isOpen = openSlot === slotIndex;

          return (
            <div key={slotIndex} className="relative">
              <button
                onClick={() => setOpenSlot(isOpen ? null : slotIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer"
                style={{
                  color,
                  borderColor: isOpen ? color : 'rgba(255,255,255,0.15)',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}
              >
                {driverCode}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isOpen && (
                <div className="absolute z-20 mt-1 w-40 max-h-56 overflow-y-auto bg-[#1a1a1a] border border-white/15 rounded-md shadow-xl py-1">
                  {otherDrivers.map((d) => (
                    <button
                      key={d.driver}
                      onClick={() => handleSwapDriver(slotIndex, d.driver)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors cursor-pointer ${
                        d.driver === driverCode ? 'font-bold' : ''
                      }`}
                      style={{ color: getTeamColor(d.team) }}
                    >
                      {d.driver}
                      <span className="text-gray-500 font-normal ml-1">{d.team}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <svg ref={svgRef} className="mx-auto block"></svg>
    </div>
  );
}

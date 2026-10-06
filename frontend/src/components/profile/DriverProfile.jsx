import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  Cell,
} from "recharts";
import FallbackImage from "../FallbackImage";
import TeamLogo from "../TeamLogo";
import ProfileTile from "./ProfileTile";
import DriverUmap3D from "./DriverUmap3D";
import { getDriverImageCandidates } from "../../constants/teamAssets";
import { TEAM_COLORS } from "../../constants/f1Colors";
import useViewModeStore from "../../store/viewModeStore";
import {
  getRaceCircuit, getDriverCareerStats, getDriverCircuitHistory,
  getDriverSeasonPerformance, getDriverSeasonHistory,
  getDriverCircuitAverages, getDriverFinishDistribution,
} from "../../lib/queries";

const n = (v) => Number(v ?? 0);

function formatName(driver) {
  return (driver || "")
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function shortCircuit(name) {
  return (name || "").replace(/Grand Prix|Circuit|Autodromo|Autódromo|International/gi, "").trim() || name;
}

// Compact labelled stat
function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#0d131c] rounded-lg py-2 px-1">
      <span className="text-lg font-bold leading-none" style={{ color: accent || "#fff" }}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wide text-gray-500 mt-1 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "#0a0e14", border: "1px solid #26303f",
    borderRadius: 8, fontSize: 11, color: "#fff",
  },
  labelStyle: { color: "#9aa4b2" },
};

export default function DriverProfile({ entry, season, round, raceName, onBack }) {
  const { isMobileView } = useViewModeStore();
  const driver = entry.driver;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    (async () => {
      const circuit = await getRaceCircuit(season, round);
      const circuitName = circuit?.circuit_name;
      const [career, circuitHistory, seasonPerf, seasonHistory, circuitAvgs, finishDist] =
        await Promise.all([
          getDriverCareerStats(driver),
          circuitName ? getDriverCircuitHistory(driver, circuitName) : Promise.resolve([]),
          getDriverSeasonPerformance(driver, season),
          getDriverSeasonHistory(driver),
          getDriverCircuitAverages(driver),
          getDriverFinishDistribution(driver),
        ]);
      if (!alive) return;
      setData({ circuit, career, circuitHistory, seasonPerf, seasonHistory, circuitAvgs, finishDist });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [driver, season, round]);

  // Team the driver actually raced for THIS weekend (not their latest team)
  const team = entry.team || data?.career?.team;
  const teamColor = TEAM_COLORS[team] || "#e10600";

  const header = (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-[#26303f] flex-shrink-0 bg-[#0d131c]">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#1b2431] hover:bg-[#26303f] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
      >
        ← Telemetry
      </button>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate">{formatName(driver)}</div>
        <div className="text-[11px] text-gray-500 truncate">
          {team} · Driver Profile
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1 h-1 rounded-full" style={{ width: 60, backgroundColor: teamColor }} />
    </div>
  );

  if (loading || !data) {
    return (
      <div className="h-full flex flex-col bg-[#0a0e14]">
        {header}
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          <div className="animate-pulse">Loading {formatName(driver)}'s profile…</div>
        </div>
      </div>
    );
  }

  const c = data.career;
  const races = n(c.races);
  const rate = (v) => (races ? Math.round((n(v) / races) * 100) : 0);

  return (
    <div className="h-full flex flex-col bg-[#0a0e14]">
      {header}
      <div className={`flex-1 min-h-0 grid gap-2 p-2 ${
        isMobileView ? "grid-cols-1 auto-rows-[360px] overflow-y-auto" : "grid-cols-3 grid-rows-2"
      }`}>

        {/* SECTION 1 — Overview: large photo + career stats */}
        <ProfileTile title="Overview" accent={teamColor}
          pages={[
            <div key="ov" className="flex gap-3 h-full">
              {/* Photo column — fills the tile height (~2.5x previous) */}
              <div className={`flex-shrink-0 flex flex-col items-center min-h-0 ${isMobileView ? "w-[110px]" : "w-[150px]"}`}>
                <FallbackImage
                  sources={getDriverImageCandidates(driver)}
                  alt={formatName(driver)}
                  className="flex-1 min-h-0 w-full object-cover object-top rounded-md"
                  fallback={<div className="flex-1 min-h-0 w-full flex items-center justify-center text-6xl text-gray-700">{formatName(driver).charAt(0)}</div>}
                />
                <div className="flex items-center gap-2 mt-1.5 flex-shrink-0">
                  <TeamLogo team={team} size={34} />
                  <span className="text-[11px] text-gray-400 truncate max-w-[100px]" style={{ color: teamColor }}>{team}</span>
                </div>
              </div>
              {/* Stats — 2 columns to sit beside the larger photo */}
              <div className="flex-1 grid grid-cols-2 grid-rows-5 gap-1.5 min-w-0">
                <Stat label="Races" value={races} />
                <Stat label="Wins" value={n(c.wins)} accent={teamColor} />
                <Stat label="Podiums" value={n(c.podiums)} accent={teamColor} />
                <Stat label="Poles" value={n(c.poles)} />
                <Stat label="Points" value={n(c.points).toLocaleString()} />
                <Stat label="Titles" value={n(c.titles)} accent={n(c.titles) ? "#FFD700" : undefined} />
                <Stat label="Best Fin" value={c.best_finish != null ? `P${n(c.best_finish)}` : "—"} />
                <Stat label="Fast Laps" value={n(c.fastest_laps)} />
                <Stat label="Avg Fin" value={c.avg_finish != null ? n(c.avg_finish).toFixed(1) : "—"} />
                <Stat label="Seasons" value={n(c.seasons)} />
              </div>
            </div>,
          ]}
        />

        {/* SECTION 2 — This circuit */}
        <ProfileTile title={`At ${shortCircuit(raceName)}`} accent={teamColor}
          pages={[
            <CircuitSummary key="cs" history={data.circuitHistory} accent={teamColor} />,
            <CircuitTrend key="ct" history={data.circuitHistory} accent={teamColor} />,
          ]}
        />

        {/* SECTION 3 — This season */}
        <ProfileTile title={`${season} Season`} accent={teamColor}
          pages={[
            <SeasonPoints key="sp" perf={data.seasonPerf} accent={teamColor} />,
            <SeasonPositions key="spo" perf={data.seasonPerf} accent={teamColor} />,
            <SeasonResults key="sr" perf={data.seasonPerf} />,
          ]}
        />

        {/* SECTION 4 — Career trajectory */}
        <ProfileTile title="Career Trajectory" accent={teamColor}
          pages={[
            <TitlePositionChart key="tp" history={data.seasonHistory} accent={teamColor} />,
            <PointsPerSeason key="pps" history={data.seasonHistory} accent={teamColor} />,
            <WinsPerSeason key="wps" history={data.seasonHistory} accent={teamColor} />,
          ]}
        />

        {/* SECTION 5 — Circuit mastery */}
        <ProfileTile title="Circuit Mastery" accent={teamColor}
          pages={[
            <BestCircuits key="bc" data={data.circuitAvgs} accent={teamColor} />,
            <FinishDistribution key="fd" data={data.finishDist} accent={teamColor} />,
          ]}
        />

        {/* SECTION 6 — 3-D UMAP driver fingerprint (precomputed) + radar */}
        <ProfileTile title="Driver DNA · 3-D UMAP" accent={teamColor}
          pages={[
            <DriverUmap3D key="umap" driver={driver} />,
            <Framed key="radar" caption="Career rate profile (% of races)">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { k: "Win %", v: rate(c.wins) },
                  { k: "Podium %", v: rate(c.podiums) },
                  { k: "Points %", v: rate(c.points_finishes) },
                  { k: "Pole %", v: rate(c.poles) },
                  { k: "Finish %", v: 100 - rate(c.dnfs) },
                  { k: "Fast Lap %", v: rate(c.fastest_laps) },
                ]}>
                  <PolarGrid stroke="#26303f" />
                  <PolarAngleAxis dataKey="k" tick={{ fill: "#9aa4b2", fontSize: 9 }} />
                  <Radar dataKey="v" stroke={teamColor} fill={teamColor} fillOpacity={0.35} />
                  <Tooltip {...tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </Framed>,
          ]}
        />
      </div>
    </div>
  );
}

// ---- Section 2 sub-tiles ----
function CircuitSummary({ history, accent }) {
  if (!history.length) return <Empty text="No appearances recorded at this circuit." />;
  const starts = history.length;
  const wins = history.filter((h) => n(h.finish_position) === 1).length;
  const podiums = history.filter((h) => h.finish_position != null && n(h.finish_position) <= 3).length;
  const finishes = history.filter((h) => h.finish_position != null);
  const best = finishes.length ? Math.min(...finishes.map((h) => n(h.finish_position))) : null;
  const avg = finishes.length ? finishes.reduce((s, h) => s + n(h.finish_position), 0) / finishes.length : null;
  const pts = history.reduce((s, h) => s + n(h.points), 0);
  return (
    <Framed caption="Career record at this circuit">
      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 h-full">
        <Stat label="Starts" value={starts} />
        <Stat label="Wins" value={wins} accent={accent} />
        <Stat label="Podiums" value={podiums} accent={accent} />
        <Stat label="Best" value={best != null ? `P${best}` : "—"} />
        <Stat label="Avg Fin" value={avg != null ? avg.toFixed(1) : "—"} />
        <Stat label="Points" value={pts} />
      </div>
    </Framed>
  );
}

function CircuitTrend({ history, accent }) {
  const rows = history.filter((h) => h.finish_position != null)
    .map((h) => ({ season: n(h.season), pos: n(h.finish_position) }));
  if (rows.length < 2) return <CircuitSummaryList history={history} />;
  return (
    <Framed caption="Finish position by season (P1 = top)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="season" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis reversed domain={[1, "dataMax"]} stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`P${v}`, "Finish"]} />
          <Line type="monotone" dataKey="pos" stroke={accent} strokeWidth={2.5} dot={{ r: 3, fill: accent }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function CircuitSummaryList({ history }) {
  return (
    <div className="h-full overflow-hidden text-[11px]">
      {history.map((h, i) => (
        <div key={i} className="flex justify-between py-0.5 border-b border-[#1b2431]">
          <span className="text-gray-400">{n(h.season)}</span>
          <span className="text-white">{h.finish_position != null ? `P${n(h.finish_position)}` : "DNF"}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Section 3 sub-tiles ----
function SeasonPoints({ perf, accent }) {
  const rows = perf.filter((r) => r.cumulative_points != null)
    .map((r) => ({ round: n(r.round), pts: n(r.cumulative_points) }));
  if (!rows.length) return <Empty text="No standings data for this season." />;
  return (
    <Framed caption="Cumulative points by round">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="round" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v} pts`, "Total"]} labelFormatter={(l) => `Round ${l}`} />
          <Line type="monotone" dataKey="pts" stroke={accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function SeasonPositions({ perf, accent }) {
  const rows = perf.filter((r) => r.finish_position != null)
    .map((r) => ({ round: n(r.round), pos: n(r.finish_position) }));
  if (!rows.length) return <Empty text="No race results for this season." />;
  return (
    <Framed caption="Finish position by round (P1 = top)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="round" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis reversed domain={[1, "dataMax"]} stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`P${v}`, "Finish"]} labelFormatter={(l) => `Round ${l}`} />
          <Line type="monotone" dataKey="pos" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function SeasonResults({ perf }) {
  if (!perf.length) return <Empty text="No results." />;
  return (
    <Framed caption="Round-by-round results">
    <div className="h-full overflow-hidden text-[10px] leading-tight">
      {perf.map((r, i) => (
        <div key={i} className="flex items-center gap-2 py-[3px] border-b border-[#1b2431]">
          <span className="text-gray-600 w-4">{n(r.round)}</span>
          <span className="flex-1 text-gray-300 truncate">{shortCircuit(r.race_name)}</span>
          <span className="text-white font-medium w-7 text-right">
            {r.finish_position != null ? `P${n(r.finish_position)}` : "DNF"}
          </span>
          <span className="text-gray-500 w-8 text-right">{n(r.points)}p</span>
        </div>
      ))}
    </div>
    </Framed>
  );
}

// ---- Section 4 sub-tiles ----
function TitlePositionChart({ history, accent }) {
  const rows = history.filter((h) => h.championship_position != null)
    .map((h) => ({ season: n(h.season), pos: n(h.championship_position) }));
  if (rows.length < 2) return <Empty text="Not enough seasons for a trajectory." />;
  return (
    <Framed caption="Championship position by season (P1 = top)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="season" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis reversed domain={[1, "dataMax"]} allowDecimals={false} stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`P${v}`, "Championship"]} />
          <Line type="monotone" dataKey="pos" stroke={accent} strokeWidth={2.5} dot={{ r: 3, fill: accent }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function PointsPerSeason({ history, accent }) {
  const rows = history.map((h) => ({ season: n(h.season), pts: n(h.points) }));
  if (!rows.length) return <Empty text="No data." />;
  return (
    <Framed caption="Points scored by season">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="season" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v} pts`, "Season"]} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="pts" fill={accent} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function WinsPerSeason({ history, accent }) {
  const rows = history.map((h) => ({ season: n(h.season), wins: n(h.wins) }));
  const total = rows.reduce((s, r) => s + r.wins, 0);
  if (!total) return <Empty text="No race wins recorded." />;
  return (
    <Framed caption="Race wins by season">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="season" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <YAxis allowDecimals={false} stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v} wins`, "Season"]} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="wins" fill={accent} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Framed>
  );
}

// ---- Section 5 sub-tiles ----
function BestCircuits({ data, accent }) {
  const rows = data.slice(0, 7).map((d) => ({
    name: shortCircuit(d.circuit_name), avg: Number(n(d.avg_finish).toFixed(1)),
  }));
  if (!rows.length) return <Empty text="No circuit data." />;
  return (
    <Framed caption="Best circuits — avg finish (lower = better)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 20, left: 4, bottom: 2 }}>
          <XAxis type="number" domain={[1, "dataMax"]} hide />
          <YAxis type="category" dataKey="name" width={70} stroke="#5b6675" tick={{ fill: "#9aa4b2", fontSize: 8 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`P${v} avg`, "Finish"]} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="avg" fill={accent} radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: "right", fill: "#9aa4b2", fontSize: 9 }} />
        </BarChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function FinishDistribution({ data, accent }) {
  const rows = data.map((d) => ({ pos: `P${n(d.position)}`, count: n(d.count), position: n(d.position) }));
  if (!rows.length) return <Empty text="No finishes recorded." />;
  return (
    <Framed caption="Finish-position distribution (podiums highlighted)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2431" />
          <XAxis dataKey="pos" stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 8 }} interval={0} />
          <YAxis allowDecimals={false} stroke="#5b6675" tick={{ fill: "#7d8899", fontSize: 9 }} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}×`, "Times"]} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.position <= 3 ? accent : "#3a4658"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Framed>
  );
}

function Empty({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-center text-[10px] text-gray-600 px-2">
      {text}
    </div>
  );
}

// Wraps a chart with a small heading so each graph says what it shows.
function Framed({ caption, children }) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1 flex-shrink-0 truncate">
        {caption}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

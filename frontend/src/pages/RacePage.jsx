import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRaceLeaderboard } from "../lib/queries";
import PositionChart from "../components/charts/PositionChart";
import PitStopGantt from "../components/charts/PitStopGantt";
import ParallelCoordinates from "../components/charts/ParallelCoordinates";
import RaceSimulator from "../components/simulator/RaceSimulator";
import TrackView from "../components/simulator/TrackView";
import DriverProfile from "../components/profile/DriverProfile";
import LoadingSkeleton from "../components/layout/LoadingSkeleton";
import FallbackImage from "../components/FallbackImage";
import { getTeamLogo, getTeamLogoScale, getDriverImageCandidates } from "../constants/teamAssets";
import { TEAM_COLORS } from "../constants/f1Colors";
import raceData from "../constants/raceLocations.json";
import useViewModeStore from "../store/viewModeStore";

const TELEMETRY_MIN_YEAR = 2018;
const TELEMETRY_MAX_YEAR = 2024;

/**
 * Race Detail Page — /race/:season/:raceId
 * 3 regions: Left leaderboard, Center race simulator (2018-2024) or static
 * track preview (older seasons), Bottom toggle panels
 */
export default function RacePage() {
  const { season, raceId } = useParams();
  const navigate = useNavigate();
  const { isMobileView } = useViewModeStore();
  const seasonNum = Number(season);

  // Find race info from static data
  const raceInfo = useMemo(() => {
    const races = raceData.racesByYear[season] || [];
    return races.find((r) => r.race_id === raceId) || { race_name: "Race" };
  }, [season, raceId]);

  // Leaderboard placeholder data (will be replaced with real query)
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeToggle, setActiveToggle] = useState(null);
  // Driver profile overlay in the center pane (null = show telemetry)
  const [selectedDriver, setSelectedDriver] = useState(null);

  const round = Number(raceId.split("_")[1]);

  // Fetch real leaderboard from HF via DuckDB
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  useEffect(() => {
    setLeaderboardLoading(true);
    setSelectedDriver(null); // reset profile when the race changes
    getRaceLeaderboard(seasonNum, round).then((data) => {
      setLeaderboard(data);
      setLeaderboardLoading(false);
    });
  }, [raceId, seasonNum, round]);

  function formatDriverName(driver) {
    return driver
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  function handleToggle(id) {
    setActiveToggle((prev) => (prev === id ? null : id));
  }

  return (
    <div className={`h-screen bg-[#0a0e14] overflow-hidden flex ${isMobileView ? "flex-col" : ""}`}>
      {/* LEFT PANEL — Leaderboard (stacks above content on mobile, scrollable within its own max-height) */}
      <aside
        className={`flex-shrink-0 bg-[#121822] flex flex-col overflow-y-auto border-[#26303f] ${
          isMobileView ? "w-full max-h-[40vh] border-b" : "w-[300px] border-r"
        }`}
      >
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="text-left text-sm text-gray-400 hover:text-white px-4 py-3 border-b border-[#26303f] cursor-pointer flex-shrink-0"
        >
          ← Back to map
        </button>

        {/* Race title */}
        <div className="px-4 py-4 border-b border-[#26303f] flex-shrink-0">
          <h2 className="text-lg font-bold text-white">{raceInfo.race_name}</h2>
          <p className="text-xs text-gray-500">Season {season} · Round {raceInfo.round}</p>
        </div>

        {/* Classification */}
        <div className="flex-1 px-2 py-2">
          {leaderboardLoading && (
            <div className="text-center text-gray-500 text-sm py-8">Loading results...</div>
          )}
          {!leaderboardLoading && leaderboard.map((entry, i) => {
            const isPodium = entry.position != null && entry.position <= 3;
            const teamColor = TEAM_COLORS[entry.team] || null;
            const teamLogo = getTeamLogo(entry.team);
            const logoScale = getTeamLogoScale(entry.team);

            if (isPodium) {
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDriver(entry)}
                  className={`flex items-center gap-3 px-3 rounded-lg cursor-pointer transition-colors ${
                    isMobileView ? "py-2" : "py-4"
                  } ${
                    selectedDriver?.driver === entry.driver ? "bg-[#1b2431] ring-1 ring-[#e10600]/50" : "hover:bg-[#1b2431]"
                  }`}
                >
                  <span className="w-6 text-center text-base font-bold text-gray-300 flex-shrink-0">
                    {entry.position}
                  </span>
                  {/* Headshot — full photo, no border, ~3x size */}
                  <FallbackImage
                    sources={getDriverImageCandidates(entry.driver)}
                    alt={formatDriverName(entry.driver)}
                    className={`w-auto object-contain object-top flex-shrink-0 ${
                      isMobileView ? "h-20 max-w-[80px]" : "h-36 max-w-[120px]"
                    }`}
                    fallback={
                      <div className={`flex items-center justify-center text-gray-600 text-3xl flex-shrink-0 ${
                        isMobileView ? "h-20 w-[60px]" : "h-36 w-[90px]"
                      }`}>
                        {formatDriverName(entry.driver).charAt(0)}
                      </div>
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: teamColor || "#ffffff" }}
                    >
                      {formatDriverName(entry.driver)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <img
                        src={teamLogo}
                        alt={entry.team}
                        onError={(e) => { e.currentTarget.src = "/f1.svg"; }}
                        className="w-4 h-4 object-contain flex-shrink-0"
                        style={{ transform: `scale(${logoScale})` }}
                      />
                      <span className="text-xs text-gray-500 truncate">{entry.team}</span>
                    </div>
                    <span className="text-xs text-gray-400">{entry.points} pts</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i}
                onClick={() => setSelectedDriver(entry)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedDriver?.driver === entry.driver ? "bg-[#1b2431] ring-1 ring-[#e10600]/50" : "hover:bg-[#1b2431]"
                }`}
              >
                <span className={`w-6 text-center text-sm font-bold ${
                  entry.status === "DNF" ? "text-red-500" : "text-gray-300"
                }`}>
                  {entry.position ?? "DNF"}
                </span>
                {/* Team logo next to name */}
                <img
                  src={teamLogo}
                  alt={entry.team}
                  onError={(e) => { e.currentTarget.src = "/f1.svg"; }}
                  className="w-5 h-5 object-contain flex-shrink-0"
                  style={{ transform: `scale(${logoScale})` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">
                    {formatDriverName(entry.driver)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{entry.team}</div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{entry.points} pts</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className={`flex-1 flex flex-col overflow-y-auto ${isMobileView ? "min-h-0" : ""}`}>
        {/* CENTER — Driver profile (when a driver is picked) else the
            Race Simulator (2018-2024) / static track (older seasons) */}
        <div className={`flex-1 ${isMobileView ? "min-h-[400px]" : ""}`}>
          {selectedDriver ? (
            <DriverProfile
              entry={selectedDriver}
              season={seasonNum}
              round={round}
              raceName={raceInfo.race_name}
              onBack={() => setSelectedDriver(null)}
            />
          ) : seasonNum >= TELEMETRY_MIN_YEAR && seasonNum <= TELEMETRY_MAX_YEAR ? (
            <RaceSimulator raceId={raceId} />
          ) : (
            <TrackView raceId={raceId} raceName={raceInfo.race_name} />
          )}
        </div>

        {/* BOTTOM — Toggle buttons + panel */}
        <div className="border-t border-[#26303f]">
          {/* Toggle buttons */}
          <div className={`flex gap-2 py-3 bg-[#121822] ${isMobileView ? "flex-wrap px-3" : "px-6"}`}>
            {[
              { id: "tire", label: "Tire Strategy" },
              { id: "position", label: "Lap-by-Lap Position" },
              { id: "strategy", label: "Strategic Archetypes" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleToggle(id)}
                className={`rounded-lg font-medium border transition-all cursor-pointer ${
                  isMobileView ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
                } ${
                  activeToggle === id
                    ? "border-[#e10600] text-[#e10600] bg-[#e10600]/10"
                    : "border-[#26303f] text-gray-400 hover:text-white hover:border-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Toggle panel content */}
          {activeToggle && (
            <div className={`bg-[#0a0e14] ${isMobileView ? "px-3 py-3 max-h-[70vh] overflow-y-auto" : "px-6 py-4"}`}>
              {activeToggle === "tire" && (
                <PitStopGantt raceId={raceId} />
              )}
              {activeToggle === "position" && (
                <PositionChart raceId={raceId} />
              )}
              {activeToggle === "strategy" && (
                <ParallelCoordinates raceId={raceId} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

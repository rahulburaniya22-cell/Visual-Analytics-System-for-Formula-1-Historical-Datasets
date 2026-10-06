import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import WorldMap from "../components/WorldMap";
import SplashScreen from "../components/SplashScreen";
import ChampionshipChart from "../components/charts/ChampionshipChart";
import EraBumpChart from "../components/charts/EraBumpChart";
import LoadingSkeleton from "../components/layout/LoadingSkeleton";
import { getChampionshipStandings, getEraStandings } from "../lib/queries";
import raceData from "../constants/raceLocations.json";
import useViewModeStore from "../store/viewModeStore";

const ALL_YEARS = Array.from({ length: 25 }, (_, i) => 2000 + i); // 2000-2024
const WINDOW_SIZE = 7;

// Module-level flag: true after first render within a JS session.
// Resets on hard refresh/new tab; survives SPA back-navigation.
let _splashDone = false;

export default function LandingPage() {
  const navigate = useNavigate();
  const { isMobileView } = useViewModeStore();
  const [showSplash, setShowSplash] = useState(() => !_splashDone);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [windowStart, setWindowStart] = useState(ALL_YEARS.length - WINDOW_SIZE);
  const [showOverYears, setShowOverYears] = useState(false);

  // Championship Progress data (bottom-right panel)
  const [champData, setChampData] = useState([]);
  const [champLoading, setChampLoading] = useState(true);

  // Era Bump Chart data (Over the Years modal)
  const [eraData, setEraData] = useState([]);
  const [eraLoading, setEraLoading] = useState(false);
  // Mobile view only: hover doesn't exist on touch, so the panel expands on tap instead
  const [champExpandedMobile, setChampExpandedMobile] = useState(false);

  const visibleYears = ALL_YEARS.slice(windowStart, windowStart + WINDOW_SIZE);

  const races = useMemo(() => {
    return raceData.racesByYear[selectedYear] || [];
  }, [selectedYear]);

  // Fetch championship standings when year changes
  useEffect(() => {
    setChampLoading(true);
    getChampionshipStandings(selectedYear).then((d) => {
      setChampData(d);
      setChampLoading(false);
    });
  }, [selectedYear]);

  // Fetch era data when modal opens (only once)
  useEffect(() => {
    if (showOverYears && eraData.length === 0) {
      setEraLoading(true);
      getEraStandings().then((d) => {
        setEraData(d);
        setEraLoading(false);
      });
    }
  }, [showOverYears]);

  function handlePrev() {
    setWindowStart((s) => Math.max(0, s - WINDOW_SIZE));
  }

  function handleNext() {
    setWindowStart((s) => Math.min(ALL_YEARS.length - WINDOW_SIZE, s + WINDOW_SIZE));
  }

  const handleRaceClick = useCallback((race) => {
    navigate(`/race/${selectedYear}/${race.race_id}`);
  }, [navigate, selectedYear]);

  return (
    <div className="relative w-full h-screen bg-[#0a0e14] overflow-hidden">
      {showSplash && <SplashScreen onDone={() => { _splashDone = true; setShowSplash(false); }} />}
      {/* World Map (full background) */}
      <div className="absolute inset-0">
        <WorldMap races={races} onRaceClick={handleRaceClick} />
      </div>

      {/* Fixed F1 logo (top-left) — stays put regardless of map zoom/pan */}
      <img
        src="/f1.svg"
        alt="F1"
        className={`fixed z-20 h-auto pointer-events-none select-none drop-shadow-[0_2px_8px_rgba(225,6,0,0.4)] ${
          isMobileView ? "top-3 left-3 w-10" : "top-5 left-6 w-16"
        }`}
      />

      {/* Floating year selector + Over the Years button */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center bg-white/[0.02] backdrop-blur-md border border-white/20 rounded-xl shadow-lg shadow-black/10 ring-1 ring-inset ring-white/10 ${
          isMobileView ? "top-2 gap-1 px-2 py-2 max-w-[96vw]" : "top-6 gap-2 px-4 py-3"
        }`}
      >
        <button
          onClick={handlePrev}
          disabled={windowStart === 0}
          className={`text-white/70 hover:text-white disabled:opacity-30 py-1 cursor-pointer disabled:cursor-default flex-shrink-0 ${
            isMobileView ? "px-1 text-base" : "px-2 text-lg"
          }`}
        >
          ←
        </button>

        <div className={`flex ${isMobileView ? "gap-0.5 overflow-x-auto no-scrollbar" : "gap-1"}`}>
          {visibleYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-lg font-medium transition-all cursor-pointer flex-shrink-0 ${
                isMobileView ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
              } ${
                year === selectedYear
                  ? "bg-[#e10600] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#1b2431]"
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={windowStart >= ALL_YEARS.length - WINDOW_SIZE}
          className={`text-white/70 hover:text-white disabled:opacity-30 py-1 cursor-pointer disabled:cursor-default flex-shrink-0 ${
            isMobileView ? "px-1 text-base" : "px-2 text-lg"
          }`}
        >
          →
        </button>

        {/* Divider */}
        <div className={`w-px h-6 bg-[#26303f] flex-shrink-0 ${isMobileView ? "mx-0.5" : "mx-1"}`} />

        {/* Over the Years button */}
        <button
          onClick={() => setShowOverYears(true)}
          className={`rounded-lg font-medium border border-[#26303f] text-gray-300 hover:text-white hover:border-[#e10600] hover:bg-[#e10600]/10 transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
            isMobileView ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
          }`}
        >
          {isMobileView ? "History" : "Over the Years"}
        </button>
      </div>

      {isMobileView ? (
        /* Championship Progress panel — mobile: tap/hold to expand (no hover on touch) */
        <div
          onClick={() => setChampExpandedMobile((e) => !e)}
          className={`absolute z-10 bg-[#121822]/90 backdrop-blur-sm border border-[#26303f] rounded-xl overflow-hidden flex flex-col transition-all duration-300 ease-out cursor-pointer ${
            champExpandedMobile
              ? "bottom-4 left-3 right-3 w-auto max-w-[94vw] h-[70vh] max-h-[80vh] border-[#e10600]/50 shadow-lg shadow-[#e10600]/10"
              : "bottom-4 left-3 w-[160px] h-[110px]"
          }`}
        >
          {!champExpandedMobile && (
            <div className="flex flex-col items-center justify-center h-full gap-1.5 px-2 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e10600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="text-white text-xs font-semibold tracking-wide">Championship Progress</span>
              <span className="text-gray-500 text-[11px]">{selectedYear} Season</span>
              <span className="text-gray-600 text-[9px]">Tap to expand</span>
            </div>
          )}
          {champExpandedMobile && (
            <div className="flex flex-col flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
                <span className="text-white text-xs font-semibold tracking-wide">Championship Progress — {selectedYear}</span>
                <button
                  onClick={() => setChampExpandedMobile(false)}
                  className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {champLoading ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <LoadingSkeleton height="100%" />
                  </div>
                ) : (
                  <div className="w-full h-full [&_.bg-\\[\\#111111\\]]:bg-transparent [&_.border-zinc-800]:border-transparent">
                    <ChampionshipChart data={champData} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Championship Progress panel — desktop: hover to expand */
        <div className="group absolute bottom-8 left-6 z-10 w-[280px] h-[160px] bg-[#121822]/90 backdrop-blur-sm border border-[#26303f] rounded-xl overflow-hidden flex flex-col transition-all duration-300 ease-out hover:w-[620px] hover:h-[560px] hover:border-[#e10600]/50 hover:shadow-lg hover:shadow-[#e10600]/10">
          {/* Collapsed state — title card */}
          <div className="flex flex-col items-center justify-center h-full gap-3 group-hover:hidden transition-opacity">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e10600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="text-white text-sm font-semibold tracking-wide">Championship Progress</span>
            <span className="text-gray-500 text-xs">{selectedYear} Season</span>
            <span className="text-gray-600 text-[10px]">Hover to expand</span>
          </div>
          {/* Expanded state — actual chart */}
          <div className="hidden group-hover:flex flex-1 overflow-hidden">
            {champLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <LoadingSkeleton height="100%" />
              </div>
            ) : (
              <div className="w-full h-full [&_.bg-\\[\\#111111\\]]:bg-transparent [&_.border-zinc-800]:border-transparent">
                <ChampionshipChart data={champData} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Over the Years" modal popup */}
      {showOverYears && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOverYears(false)}
          />
          {/* Modal */}
          <div className={`relative max-w-[1100px] h-[90vh] max-h-[850px] bg-[#121822] border border-[#26303f] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
            isMobileView ? "w-[95vw]" : "w-[92vw]"
          }`}>
            {/* Header */}
            <div className={`border-b border-[#26303f] flex items-center justify-between gap-2 ${
              isMobileView ? "px-3 py-3" : "px-6 py-4"
            }`}>
              <h2 className={`font-bold text-white truncate ${isMobileView ? "text-sm" : "text-lg"}`}>Over the Years (2000–2024)</h2>
              <button
                onClick={() => setShowOverYears(false)}
                className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer px-2 flex-shrink-0"
              >
                ✕
              </button>
            </div>
            {/* Content */}
            <div className={`flex-1 overflow-y-auto overflow-x-auto ${isMobileView ? "p-3" : "p-6"}`}>
              {eraLoading ? (
                <LoadingSkeleton height="450px" />
              ) : eraData.length > 0 ? (
                <EraBumpChart data={eraData} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Loading era data...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hint text */}
      {!isMobileView && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 text-sm z-10">
          Select a season, then click a race pin to dive in.
        </p>
      )}
    </div>
  );
}

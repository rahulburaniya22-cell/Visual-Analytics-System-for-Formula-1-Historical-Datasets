import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamColor } from "../../../constants/f1Colors";
import { buildComparisonDataset, sliceUpToLap } from "./comparisonData";
import { shortCode } from "./CompareTooltip";
import PaceChart from "./PaceChart";
import DynamicsCharts from "./DynamicsCharts";
import MetricScatter from "./MetricScatter";
import useViewModeStore from "../../../store/viewModeStore";

const TABS = [
  { key: "pace", label: "Pace" },
  { key: "dynamics", label: "Dynamics" },
  { key: "scatter", label: "Scatter" },
];
const MAX_SCATTER_SLOTS = 3;

/**
 * Floating comparison widget over the sim canvas. Collapsed it's a small
 * pill; hovering expands it into the full chart panel (pin to keep it open).
 * The sim's rAF loop is untouched, so the replay keeps running behind it.
 * Charts only see data up to `currentLap`, so they fill in live as the
 * simulation progresses.
 */
export default function ComparisonPanel({ race, lapsRows, compare, currentLap, nLaps, onRemoveDriver, onClear }) {
  const { isMobileView } = useViewModeStore();
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tab, setTab] = useState("pace");
  const [paceMode, setPaceMode] = useState("lapTime");
  const [showPits, setShowPits] = useState(false);
  const [baseline, setBaseline] = useState("leader");
  const collapseTimer = useRef(null);

  const dataset = useMemo(() => buildComparisonDataset(race, lapsRows), [race, lapsRows]);

  const [scatterSlots, setScatterSlots] = useState(null);
  const slots = scatterSlots ?? [
    { x: dataset.hasLapsTable ? "tireAge" : "lap", y: "lapTime" },
  ];

  const compareKey = compare.join(",");
  const slices = useMemo(
    () => sliceUpToLap(dataset.byDriver, compare, currentLap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, compareKey, currentLap]
  );

  // If the gap baseline driver is deselected, fall back to the leader
  useEffect(() => {
    if (baseline !== "leader" && !compare.includes(baseline)) setBaseline("leader");
  }, [compare, baseline]);

  useEffect(() => () => clearTimeout(collapseTimer.current), []);

  function enter() {
    clearTimeout(collapseTimer.current);
    setExpanded(true);
  }
  function leave() {
    if (pinned) return;
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 300);
  }

  const open = expanded || pinned;

  return (
    <div
      className={`absolute top-2 right-2 z-10 rounded-lg bg-black/70 backdrop-blur border border-[#26303f] transition-all overflow-hidden ${
        open ? "w-[min(600px,92%)] max-h-[80%] flex flex-col" : "cursor-pointer"
      }`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onClick={() => { if (isMobileView && !open) setExpanded(true); }}
    >
      {!open ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
            ⇄ Compare
          </span>
          <span className="flex items-center gap-1">
            {compare.map((code) => (
              <span key={code} className="flex items-center gap-0.5">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: getTeamColor(dataset.teams.get(code)) }}
                />
                <span className="text-[10px] text-gray-400">{shortCode(code)}</span>
              </span>
            ))}
          </span>
        </div>
      ) : (
        <>
          {/* Header: tabs + driver chips + pin/clear */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#26303f] flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer border ${
                  tab === t.key
                    ? "border-[#e10600] text-[#e10600] bg-[#e10600]/10"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="mx-1 w-px h-4 bg-[#26303f]" />
            {compare.map((code) => {
              const total = (dataset.byDriver.get(code) || []).length;
              const out = total < nLaps && currentLap > total;
              return (
                <span
                  key={code}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1b2431] text-[10px] text-gray-200"
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: getTeamColor(dataset.teams.get(code)) }}
                  />
                  {shortCode(code)}
                  {out && <span className="text-red-400">OUT L{total}</span>}
                  <button
                    onClick={() => onRemoveDriver(code)}
                    className="text-gray-500 hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <span className="ml-auto flex items-center gap-1">
              {!dataset.hasLapsTable && (
                <span
                  className="text-[10px] text-amber-500/80"
                  title="No official lap data for this race — stats are derived from telemetry"
                >
                  approx. data
                </span>
              )}
              <button
                onClick={() => setPinned((p) => !p)}
                title={pinned ? "Unpin" : "Pin open"}
                className={`px-1.5 py-0.5 rounded text-xs cursor-pointer ${
                  pinned ? "bg-[#e10600]/20 text-[#e10600]" : "text-gray-400 hover:text-white"
                }`}
              >
                📌
              </button>
              <button
                onClick={onClear}
                title="Clear selection"
                className="px-1.5 py-0.5 rounded text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
              {isMobileView && !pinned && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearTimeout(collapseTimer.current); setExpanded(false); }}
                  title="Collapse"
                  className="px-1.5 py-0.5 rounded text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  ▾
                </button>
              )}
            </span>
          </div>

          {/* Body */}
          <div className="p-2 overflow-y-auto">
            {compare.length === 1 && (
              <div className="text-[11px] text-gray-500 mb-1.5">
                Add another driver from the Live Order list to compare.
              </div>
            )}
            {tab === "pace" && (
              <PaceChart
                slices={slices}
                codes={compare}
                teams={dataset.teams}
                nLaps={nLaps}
                mode={paceMode}
                onModeChange={setPaceMode}
                showPits={showPits}
                onShowPitsChange={setShowPits}
              />
            )}
            {tab === "dynamics" && (
              <DynamicsCharts
                slices={slices}
                codes={compare}
                teams={dataset.teams}
                nLaps={nLaps}
                fieldSize={race.drivers.length}
                baseline={baseline}
                onBaselineChange={setBaseline}
              />
            )}
            {tab === "scatter" && (
              <div>
                <div className="flex gap-3 flex-wrap">
                  {slots.map((slot, i) => (
                    <MetricScatter
                      key={i}
                      slices={slices}
                      codes={compare}
                      teams={dataset.teams}
                      xKey={slot.x}
                      yKey={slot.y}
                      hasLapsTable={dataset.hasLapsTable}
                      onChangeX={(x) =>
                        setScatterSlots(slots.map((s, j) => (j === i ? { ...s, x } : s)))
                      }
                      onChangeY={(y) =>
                        setScatterSlots(slots.map((s, j) => (j === i ? { ...s, y } : s)))
                      }
                      onRemove={() => setScatterSlots(slots.filter((_, j) => j !== i))}
                      canRemove={slots.length > 1}
                    />
                  ))}
                </div>
                {slots.length < MAX_SCATTER_SLOTS && (
                  <button
                    onClick={() =>
                      setScatterSlots([...slots, { x: "lap", y: "lapTime" }])
                    }
                    className="mt-1.5 px-2 py-0.5 rounded text-[11px] border border-[#26303f] text-gray-400 hover:text-white cursor-pointer"
                  >
                    + add chart
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

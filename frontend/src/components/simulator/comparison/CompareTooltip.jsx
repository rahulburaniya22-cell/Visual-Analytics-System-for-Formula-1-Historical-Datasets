import { COMPOUND_COLORS } from "../../../constants/f1Colors";
import { metricByKey } from "./comparisonData";

/** Short display code from an ergast-style id: max_verstappen -> VER. */
export function shortCode(code) {
  const last = code.split("_").pop();
  return last.slice(0, 3).toUpperCase();
}

/** Format a metric value for display (lap times as m:ss.t, rest with unit). */
export function fmtMetric(key, v) {
  if (v == null) return "—";
  const m = metricByKey(key);
  if (key === "lapTime" || key === "sector1" || key === "sector2" || key === "sector3") {
    if (v >= 60) {
      const min = Math.floor(v / 60);
      return `${min}:${(v - min * 60).toFixed(1).padStart(4, "0")}`;
    }
    return `${v.toFixed(1)}s`;
  }
  if (key === "gapToLeader") return `+${v.toFixed(1)}s`;
  if (key === "lap" || key === "position" || key === "tireAge") {
    return `${Math.round(v)}${m?.unit ? " " + m.unit : ""}`;
  }
  return `${v.toFixed(1)}${m?.unit ? " " + m.unit : ""}`;
}

function CompoundChip({ compound }) {
  if (!compound) return null;
  return (
    <span
      className="ml-1 inline-block w-2 h-2 rounded-full border border-black/40"
      title={compound}
      style={{ backgroundColor: COMPOUND_COLORS[compound] || "#888" }}
    />
  );
}

/** Tooltip for the multi-driver line charts (pace, position, gap). */
export function LineTooltip({ active, payload, label, metricKey }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && !p.dataKey.endsWith("__pit"));
  if (!rows.length) return null;
  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 shadow-xl">
      <div className="text-xs font-semibold text-gray-300 mb-1">Lap {label}</div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.dataKey} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: row.stroke }}
            />
            <span className="text-gray-200">{shortCode(row.dataKey)}</span>
            <span className="text-gray-400 ml-auto tabular-nums">
              {fmtMetric(metricKey, row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tooltip for scatter points: driver, lap, both axis values, compound. */
export function ScatterTooltip({ active, payload, xKey, yKey }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 shadow-xl text-[11px]">
      <div className="flex items-center gap-2 font-semibold text-gray-200 mb-1">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: pt.color }} />
        {shortCode(pt.code)} · Lap {pt.lap}
        <CompoundChip compound={pt.compound} />
      </div>
      <div className="text-gray-400">
        {metricByKey(xKey)?.label}: <span className="text-gray-200 tabular-nums">{fmtMetric(xKey, pt.x)}</span>
      </div>
      <div className="text-gray-400">
        {metricByKey(yKey)?.label}: <span className="text-gray-200 tabular-nums">{fmtMetric(yKey, pt.y)}</span>
      </div>
      {pt.isPitLap && <div className="text-amber-400 mt-0.5">pit in/out lap</div>}
    </div>
  );
}

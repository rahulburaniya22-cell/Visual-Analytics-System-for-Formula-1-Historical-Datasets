import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getTeamColor } from "../../../constants/f1Colors";
import { LineTooltip } from "./CompareTooltip";

const MODES = [
  { key: "lapTime", label: "Lap times" },
  { key: "sector1", label: "S1 (⅓)" },
  { key: "sector2", label: "S2 (⅓)" },
  { key: "sector3", label: "S3 (⅓)" },
  { key: "stint", label: "Stint pace" },
];

/**
 * Hollow marker for pit/outlier laps, drawn off the pace line via a
 * marker-only Line (stroke="none") rather than a separate <Scatter> —
 * mixing Line and Scatter series in one ComposedChart trips a Recharts
 * internal key collision.
 */
function hollowDot(color) {
  return ({ cx, cy }) => {
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={3} fill="none" stroke={color} strokeWidth={1.5} />;
  };
}

/**
 * Multi-driver pace sparklines. Lines only reach the current sim lap (the
 * slices passed in are pre-cut), while the X domain is fixed to the full race
 * so lines grow rightward as the simulation progresses.
 */
export default function PaceChart({ slices, codes, teams, nLaps, mode, onModeChange, showPits, onShowPitsChange }) {
  const { rows, hasOutliers } = useMemo(() => {
    let maxLap = 0;
    for (const code of codes) {
      const recs = slices.get(code) || [];
      if (recs.length > maxLap) maxLap = recs.length;
    }
    const rows = [];
    let hasOutliers = false;
    for (let L = 1; L <= maxLap; L++) {
      const row = { lap: L };
      for (const code of codes) {
        const rec = (slices.get(code) || [])[L - 1];
        if (!rec) continue;
        if (mode === "stint") {
          // 5-lap rolling mean of clean lap times ending at this lap
          const recs = slices.get(code);
          let sum = 0;
          let cnt = 0;
          for (let k = Math.max(0, L - 5); k < L; k++) {
            if (!recs[k].outlier && recs[k].lapTime > 0) {
              sum += recs[k].lapTime;
              cnt++;
            }
          }
          if (cnt > 0) row[code] = sum / cnt;
        } else {
          const v = rec[mode];
          if (v == null || v <= 0) continue;
          if (rec.outlier && !showPits && mode !== "stint") {
            row[`${code}__pit`] = v; // hollow dot, off the line
            hasOutliers = true;
          } else {
            row[code] = v;
          }
        }
      }
      rows.push(row);
    }
    return { rows, hasOutliers };
  }, [slices, codes, mode, showPits]);

  const metricKey = mode === "stint" ? "lapTime" : mode;

  return (
    <div>
      <div className="flex items-center gap-1 mb-1 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={`px-2 py-0.5 rounded text-[11px] cursor-pointer border ${
              mode === m.key
                ? "border-[#e10600] text-[#e10600] bg-[#e10600]/10"
                : "border-[#26303f] text-gray-400 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showPits}
            onChange={(e) => onShowPitsChange(e.target.checked)}
            className="accent-[#e10600]"
          />
          pit/SC laps
        </label>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#1b2431" strokeDasharray="3 3" />
          <XAxis
            dataKey="lap"
            type="number"
            domain={[1, Math.max(2, nLaps)]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            stroke="#26303f"
            allowDecimals={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            stroke="#26303f"
            tickFormatter={(v) => v.toFixed(0)}
          />
          <Tooltip content={<LineTooltip metricKey={metricKey} />} />
          {codes.map((code) => (
            <Line
              key={code}
              dataKey={code}
              stroke={getTeamColor(teams.get(code))}
              strokeWidth={1.8}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {hasOutliers &&
            codes.map((code) => (
              <Line
                key={`${code}__pit`}
                dataKey={`${code}__pit`}
                stroke="none"
                dot={hollowDot(getTeamColor(teams.get(code)))}
                legendType="none"
                isAnimationActive={false}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
      {mode !== "lapTime" && mode !== "stint" && (
        <div className="text-[10px] text-gray-600 mt-0.5">
          Sectors are track thirds derived from telemetry — not official timing sectors.
        </div>
      )}
    </div>
  );
}

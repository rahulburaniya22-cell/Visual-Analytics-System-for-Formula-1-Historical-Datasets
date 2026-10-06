import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { getTeamColor } from "../../../constants/f1Colors";
import { LineTooltip, shortCode } from "./CompareTooltip";

/**
 * Race dynamics: a position bump chart (leader baseline at P1) and a gap
 * chart whose baseline is the leader or any compared driver.
 */
export default function DynamicsCharts({ slices, codes, teams, nLaps, fieldSize, baseline, onBaselineChange }) {
  const posRows = useMemo(() => {
    const rows = [];
    let maxLap = 0;
    for (const code of codes) maxLap = Math.max(maxLap, (slices.get(code) || []).length);
    for (let L = 1; L <= maxLap; L++) {
      const row = { lap: L };
      for (const code of codes) {
        const rec = (slices.get(code) || [])[L - 1];
        if (rec?.position != null) row[code] = rec.position;
      }
      rows.push(row);
    }
    return rows;
  }, [slices, codes]);

  const gapRows = useMemo(() => {
    const base = baseline !== "leader" ? slices.get(baseline) || [] : null;
    const rows = [];
    let maxLap = 0;
    for (const code of codes) maxLap = Math.max(maxLap, (slices.get(code) || []).length);
    for (let L = 1; L <= maxLap; L++) {
      const row = { lap: L };
      const baseGap = base ? base[L - 1]?.gapToLeader : 0;
      for (const code of codes) {
        const rec = (slices.get(code) || [])[L - 1];
        if (rec?.gapToLeader == null) continue;
        row[code] = base
          ? baseGap != null
            ? rec.gapToLeader - baseGap
            : undefined
          : rec.gapToLeader;
      }
      rows.push(row);
    }
    return rows;
  }, [slices, codes, baseline]);

  const axisProps = {
    tick: { fill: "#6b7280", fontSize: 10 },
    stroke: "#26303f",
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] text-gray-400 mb-0.5">Position (P1 top)</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={posRows} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="#1b2431" strokeDasharray="3 3" />
            <XAxis dataKey="lap" type="number" domain={[1, Math.max(2, nLaps)]} allowDecimals={false} {...axisProps} />
            <YAxis reversed domain={[1, Math.max(2, fieldSize)]} allowDecimals={false} {...axisProps} />
            <Tooltip content={<LineTooltip metricKey="position" />} />
            <ReferenceLine y={1} stroke="#4b5563" strokeDasharray="4 4" />
            {codes.map((code) => (
              <Line
                key={code}
                dataKey={code}
                type="stepAfter"
                stroke={getTeamColor(teams.get(code))}
                strokeWidth={1.8}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] text-gray-400">Gap to</span>
          <select
            value={baseline}
            onChange={(e) => onBaselineChange(e.target.value)}
            className="bg-[#1b2431] border border-[#26303f] rounded text-[11px] text-gray-200 px-1 py-0.5 cursor-pointer"
          >
            <option value="leader">Leader</option>
            {codes.map((c) => (
              <option key={c} value={c}>
                {shortCode(c)}
              </option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={gapRows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#1b2431" strokeDasharray="3 3" />
            <XAxis dataKey="lap" type="number" domain={[1, Math.max(2, nLaps)]} allowDecimals={false} {...axisProps} />
            <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `${v.toFixed(0)}s`} {...axisProps} />
            <Tooltip content={<LineTooltip metricKey="gapToLeader" />} />
            <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="4 4" />
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

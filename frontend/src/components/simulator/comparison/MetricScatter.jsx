import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getTeamColor } from "../../../constants/f1Colors";
import { METRICS, metricByKey } from "./comparisonData";
import { ScatterTooltip } from "./CompareTooltip";

function MetricSelect({ value, onChange, hasLapsTable }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#1b2431] border border-[#26303f] rounded text-[11px] text-gray-200 px-1 py-0.5 cursor-pointer max-w-[110px]"
    >
      {METRICS.map((m) => (
        <option
          key={m.key}
          value={m.key}
          disabled={m.needsLapsTable && !hasLapsTable}
          title={m.needsLapsTable && !hasLapsTable ? "Requires 2022+ lap data" : undefined}
        >
          {m.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One relationship scatter: X/Y metric pickers, one point per driver-lap,
 * hover shows driver / lap / values / compound.
 */
export default function MetricScatter({ slices, codes, teams, xKey, yKey, onChangeX, onChangeY, onRemove, canRemove, hasLapsTable }) {
  const series = useMemo(() => {
    return codes.map((code) => {
      const color = getTeamColor(teams.get(code));
      const pts = [];
      for (const rec of slices.get(code) || []) {
        const x = rec[xKey];
        const y = rec[yKey];
        if (x == null || y == null) continue;
        pts.push({
          x,
          y,
          lap: rec.lap,
          code,
          color,
          compound: rec.compound,
          isPitLap: rec.isPitLap || rec.outlier,
        });
      }
      return { code, color, pts };
    });
  }, [slices, codes, teams, xKey, yKey]);

  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center gap-1 mb-1">
        <MetricSelect value={yKey} onChange={onChangeY} hasLapsTable={hasLapsTable} />
        <span className="text-[10px] text-gray-500">vs</span>
        <MetricSelect value={xKey} onChange={onChangeX} hasLapsTable={hasLapsTable} />
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove chart"
            className="ml-auto text-gray-500 hover:text-white text-xs cursor-pointer px-1"
          >
            ✕
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#1b2431" strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            name={metricByKey(xKey)?.label}
            domain={["auto", "auto"]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            stroke="#26303f"
            tickFormatter={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={metricByKey(yKey)?.label}
            domain={["auto", "auto"]}
            reversed={yKey === "position"}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            stroke="#26303f"
            tickFormatter={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))}
          />
          <Tooltip content={<ScatterTooltip xKey={xKey} yKey={yKey} />} cursor={{ strokeDasharray: "3 3", stroke: "#4b5563" }} />
          {series.map((s) => (
            <Scatter key={s.code} data={s.pts} fill={s.color} fillOpacity={0.8} isAnimationActive={false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

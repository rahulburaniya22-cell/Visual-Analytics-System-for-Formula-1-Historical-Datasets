import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { COMPOUND_COLORS } from "../../constants/f1Colors";
import { getStintStrategyData } from "../../lib/queries";
import LoadingSkeleton from "../layout/LoadingSkeleton";
import useViewModeStore from "../../store/viewModeStore";

const PREFERRED_DIMENSIONS = [
  "avg_lap_time",
  "compound",
  "stint_length",
  "tire_age_at_end",
  "starting_position",
];

/**
 * ParallelCoordinates
 * Parallel coordinates plot for tire stints. One polyline per stint,
 * colored by compound. Supports brushing (drag on any axis to filter).
 * Props: { raceId: string }
 */
export default function ParallelCoordinates({ raceId }) {
  const { isMobileView } = useViewModeStore();
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(900);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    getStintStrategyData(raceId).then((rows) => {
      setData(rows);
      setLoading(false);
    });
  }, [raceId]);

  // Mobile view only: track container width so the chart adapts (keeps axis
  // labels legible instead of shrinking the whole SVG). Desktop keeps the
  // original fixed 900px chart.
  useEffect(() => {
    if (!isMobileView) { setChartWidth(900); return; }
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setChartWidth(Math.max(320, el.clientWidth - 32));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobileView]);

  // Render chart
  useEffect(() => {
    if (!data.length || !svgRef.current) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 40, right: 10, bottom: 20, left: 10 };
    const width = chartWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Only draw axes for fields present in data
    const dimensions = PREFERRED_DIMENSIONS.filter(
      (dim) => data[0][dim] !== undefined && data[0][dim] !== null
    );

    const y = {};
    for (const dim of dimensions) {
      if (dim === "compound") {
        y[dim] = d3
          .scalePoint()
          .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
          .range([height, 0])
          .padding(0.5);
      } else if (dim === "starting_position") {
        const maxPos = d3.max(data, (d) => +d[dim]) || 20;
        y[dim] = d3.scaleLinear().domain([maxPos, 1]).range([height, 0]);
      } else {
        y[dim] = d3
          .scaleLinear()
          .domain(d3.extent(data, (d) => +d[dim]))
          .range([height, 0])
          .nice();
      }
    }

    const x = d3.scalePoint().range([0, width]).padding(1).domain(dimensions);
    const path = (d) => d3.line()(dimensions.map((p) => [x(p), y[p](d[p])]));

    const paths = svg
      .selectAll("myPath")
      .data(data)
      .enter()
      .append("path")
      .attr("d", path)
      .style("fill", "none")
      .style("stroke", (d) => COMPOUND_COLORS[d.compound] || "#888")
      .style("stroke-width", 2)
      .style("opacity", 0.5);

    const axes = svg
      .selectAll("myAxis")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${x(d)})`)
      .each(function (d) {
        d3.select(this).call(d3.axisLeft().scale(y[d]));
      });

    axes.selectAll("text").style("fill", "#bbb").style("font-size", "10px");
    axes.selectAll("path, line").style("stroke", "#444");
    axes
      .append("text")
      .style("text-anchor", "middle")
      .attr("y", -15)
      .text((d) => d.replace(/_/g, " ").toUpperCase())
      .style("fill", "#fff")
      .style("font-size", "11px")
      .style("font-weight", "bold");

    // Brushing
    const selections = new Map();
    const brushable = dimensions.filter((d) => d !== "compound");

    const brushed = (event, key) => {
      if (event.selection === null) selections.delete(key);
      else selections.set(key, event.selection.map(y[key].invert));

      paths.style("opacity", (d) => {
        let active = true;
        for (const [k, ext] of selections) {
          if (d[k] < ext[1] || d[k] > ext[0]) active = false;
        }
        return active ? 0.85 : 0.05;
      });
    };

    axes
      .filter((d) => brushable.includes(d))
      .append("g")
      .attr("class", "brush")
      .each(function (d) {
        d3.select(this).call(
          d3.brushY().extent([[-10, 0], [10, height]]).on("brush end", (e) => brushed(e, d))
        );
      });
  }, [data, chartWidth]);

  if (loading) return <LoadingSkeleton height="450px" />;
  if (!data.length) return <div className="text-gray-500 text-sm text-center py-8">No stint strategy data available</div>;

  return (
    <div ref={wrapRef} className="w-full bg-[#0a0a0a] p-4 rounded-xl border border-gray-800">
      <h2 className="text-white text-lg font-semibold mb-4">Strategic Archetypes</h2>
      <svg ref={svgRef} className="mx-auto block max-w-full"></svg>
      <p className="text-[10px] text-gray-500 mt-2">
        Drag on any axis to brush-select and highlight matching stints.
      </p>
    </div>
  );
}

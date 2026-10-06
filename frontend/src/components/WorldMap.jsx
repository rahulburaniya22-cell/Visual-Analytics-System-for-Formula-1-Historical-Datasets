import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const CIRCUIT_IMAGE_MAP = {
  albert_park: "melbourne-1",
  interlagos: "interlagos-1",
  imola: "imola-1",
  silverstone: "silverstone-1",
  catalunya: "catalunya-1",
  nurburgring: "nurburgring-1",
  monaco: "monaco-1",
  villeneuve: "montreal-1",
  magny_cours: "magny-cours-1",
  red_bull_ring: "spielberg-1",
  hockenheimring: "hockenheimring-1",
  hungaroring: "hungaroring-1",
  spa: "spa-francorchamps-1",
  monza: "monza-1",
  indianapolis: "indianapolis-1",
  suzuka: "suzuka-1",
  sepang: "sepang-1",
  bahrain: "bahrain-1",
  shanghai: "shanghai-1",
  istanbul: "istanbul-1",
  fuji: "fuji-1",
  valencia: "valencia-1",
  marina_bay: "marina-bay-1",
  yas_marina: "yas-marina-1",
  yeongam: "yeongam-1",
  buddh: "buddh-1",
  americas: "austin-1",
  sochi: "sochi-1",
  rodriguez: "mexico-city-1",
  baku: "baku-1",
  ricard: "paul-ricard-1",
  mugello: "mugello-1",
  portimao: "portimao-1",
  zandvoort: "zandvoort-1",
  losail: "lusail-1",
  jeddah: "jeddah-1",
  miami: "miami-1",
  vegas: "las-vegas-1",
};

/**
 * WorldMap — D3-based world map with race location pins.
 * Supports pinch-to-zoom and double-click to pan/recenter.
 * Props:
 *   races: [{ race_id, round, race_name, lat, lng }]
 *   onRaceClick: (race) => void
 */
export default function WorldMap({ races = [], onRaceClick }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // { race, x, y }

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = svgRef.current.getBoundingClientRect();
    if (!width || !height) return;

    const projection = d3
      .geoNaturalEarth1()
      .scale(width / 6.2)
      .translate([width / 2, height / 2]);
    const path = d3.geoPath(projection);

    // Main group that will be zoomed/panned
    const mapGroup = svg.append("g").attr("id", "mapGroup");
    const landG = mapGroup.append("g").attr("class", "land-layer");
    const dotsG = mapGroup.append("g").attr("class", "dots-layer");

    // Set up zoom behavior (pinch-to-zoom + double-click to pan)
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        mapGroup.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Double-click: smooth pan to clicked point (re-center)
    svg.on("dblclick.zoom", null); // disable default double-click zoom
    svg.on("dblclick", (event) => {
      const [mx, my] = d3.pointer(event, svg.node());
      const currentTransform = d3.zoomTransform(svg.node());
      const newTransform = currentTransform.translate(
        width / 2 - mx,
        height / 2 - my
      );
      svg.transition().duration(500).call(zoom.transform, newTransform);
    });

    // Load world topology
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((topo) => {
        const countries = topojson.feature(topo, topo.objects.countries).features;
        landG
          .selectAll("path")
          .data(countries)
          .join("path")
          .attr("d", path)
          .attr("fill", "#1b2431")
          .attr("stroke", "#2f3b4d")
          .attr("stroke-width", 0.5)
          .style("transition", "fill 0.25s ease, stroke 0.25s ease")
          .style("cursor", "default")
          .on("mouseenter", function () {
            d3.select(this)
              .attr("fill", "#2a1a1e")
              .attr("stroke", "#e10600")
              .attr("stroke-width", 0.8);
          })
          .on("mouseleave", function () {
            d3.select(this)
              .attr("fill", "#1b2431")
              .attr("stroke", "#2f3b4d")
              .attr("stroke-width", 0.5);
          });

        // Race dots
        dotsG
          .selectAll("circle")
          .data(races, (d) => d.race_id)
          .join("circle")
          .attr("cx", (d) => projection([d.lng, d.lat])[0])
          .attr("cy", (d) => projection([d.lng, d.lat])[1])
          .attr("r", 0)
          .attr("fill", "#e10600")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("click", (event, d) => {
            event.stopPropagation();
            onRaceClick && onRaceClick(d);
          })
          .on("mouseenter", (event, d) => {
            const rect = svgRef.current.getBoundingClientRect();
            setTooltip({ race: d, x: event.clientX - rect.left, y: event.clientY - rect.top });
          })
          .on("mousemove", (event) => {
            const rect = svgRef.current.getBoundingClientRect();
            setTooltip((prev) => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
          })
          .on("mouseleave", () => setTooltip(null))
          .transition()
          .duration(400)
          .attr("r", 5);
      })
      .catch((e) => console.warn("World atlas failed to load", e));
  }, [races, onRaceClick]);

  const circuitImg = tooltip
    ? (CIRCUIT_IMAGE_MAP[tooltip.race.circuit_id] ?? tooltip.race.circuit_id + "-1")
    : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", touchAction: "none" }}>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-label="World map of race locations"
      />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: tooltip.y < 160
              ? "translate(-50%, 14px)"
              : "translate(-50%, calc(-100% - 14px))",
            pointerEvents: "none",
            background: "rgba(10, 14, 20, 0.95)",
            border: "1px solid #e10600",
            borderRadius: "10px",
            padding: "10px 12px 8px",
            zIndex: 30,
            textAlign: "center",
            minWidth: "160px",
            boxShadow: "0 4px 20px rgba(225,6,0,0.25)",
          }}
        >
          <img
            src={`/circuits/white-outline/${circuitImg}.svg`}
            alt={tooltip.race.race_name}
            onError={(e) => { e.target.style.display = "none"; }}
            style={{
              width: "150px",
              height: "85px",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
              filter: "brightness(0) invert(1)",
            }}
          />
          <div
            style={{
              color: "#fff",
              fontSize: "12px",
              fontWeight: "600",
              marginTop: "6px",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            {tooltip.race.race_name}
          </div>
        </div>
      )}
    </div>
  );
}

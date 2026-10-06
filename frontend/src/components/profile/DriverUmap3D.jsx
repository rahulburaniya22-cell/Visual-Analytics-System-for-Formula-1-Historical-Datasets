import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTeamColor } from "../../constants/f1Colors";

const formatName = (id) =>
  id.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

/**
 * Shared interactive 3-D scatter renderer (canvas, no 3-D library).
 * Points are precomputed; this only rotates/projects them.
 */
function UmapCanvas({ points, driver, big = false }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  const rot = useRef({ ax: -0.35, ay: 0.6 });
  const drag = useRef({ active: false, lx: 0, ly: 0, idle: 0 });
  const zoom = useRef(1);
  const redrawRef = useRef(null);

  useEffect(() => {
    if (!points || !points.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    function frame(advance) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (advance && !drag.current.active) {
        drag.current.idle += 1;
        if (drag.current.idle > 40) rot.current.ay += 0.003;
      }

      const { ax, ay } = rot.current;
      const cosY = Math.cos(ay), sinY = Math.sin(ay);
      const cosX = Math.cos(ax), sinX = Math.sin(ax);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.42 * zoom.current;
      const camZ = 3;
      const selfR = big ? 9 : 6.5;
      const otherR = big ? 4.5 : 3.2;

      const proj = points.map((p, i) => {
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.x * sinY + p.z * cosY;
        let y1 = p.y * cosX - z1 * sinX;
        let z2 = p.y * sinX + z1 * cosX;
        const persp = camZ / (camZ - z2);
        return {
          i, p,
          sx: cx + x1 * R * persp,
          sy: cy - y1 * R * persp,
          depth: z2,
          size: (p.driver === driver ? selfR : otherR) * persp,
        };
      });
      proj.sort((a, b) => a.depth - b.depth);

      let selfPt = null;
      for (const pt of proj) {
        const isSelf = pt.p.driver === driver;
        const t = (pt.depth + 1.4) / 2.8;
        const alpha = isSelf ? 1 : Math.max(0.25, Math.min(1, t)) * 0.85;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, pt.size, 0, Math.PI * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = getTeamColor(pt.p.team);
        ctx.fill();
        if (isSelf) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = big ? 3 : 2;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
          selfPt = pt;
        }
      }
      ctx.globalAlpha = 1;

      if (selfPt) {
        ctx.font = `600 ${big ? 14 : 11}px system-ui, sans-serif`;
        const label = formatName(driver);
        const tw = ctx.measureText(label).width;
        let lx = selfPt.sx + 10, ly = selfPt.sy - 10;
        if (lx + tw > W - 4) lx = selfPt.sx - tw - 10;
        ctx.fillStyle = "rgba(10,14,20,0.85)";
        ctx.fillRect(lx - 3, ly - (big ? 14 : 11), tw + 6, big ? 19 : 15);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, lx, ly);
      }
      canvas._proj = proj;
    }

    redrawRef.current = () => frame(false);
    frame(false);
    function tick() { frame(true); raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick);
    const onVis = () => { if (!document.hidden) frame(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [points, driver, big]);

  function onDown(e) {
    drag.current.active = true;
    drag.current.lx = e.clientX; drag.current.ly = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    const canvas = canvasRef.current;
    if (drag.current.active) {
      const dx = e.clientX - drag.current.lx;
      const dy = e.clientY - drag.current.ly;
      // Natural "grab & drag": the front of the cloud follows the cursor.
      // The projection makes the two axes need opposite signs.
      rot.current.ay -= dx * 0.008;
      rot.current.ax += dy * 0.008;
      rot.current.ax = Math.max(-1.4, Math.min(1.4, rot.current.ax));
      drag.current.lx = e.clientX; drag.current.ly = e.clientY;
      drag.current.idle = 0;
      setHover(null);
      redrawRef.current?.();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const proj = canvas._proj || [];
    let best = null, bd = 120;
    for (const pt of proj) {
      const d = (pt.sx - mx) ** 2 + (pt.sy - my) ** 2;
      if (d < bd && d < 110) { bd = d; best = pt; }
    }
    if (best) {
      const p = best.p;
      setHover({
        name: formatName(p.driver),
        line: `${p.team} · ${p.races} races · ${p.wins}W ${p.podiums}P`,
        sx: best.sx, sy: best.sy,
      });
    } else setHover(null);
  }
  function onUp(e) {
    drag.current.active = false;
    drag.current.idle = 0;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }
  function onWheel(e) {
    zoom.current = Math.max(0.6, Math.min(2.6, zoom.current + e.deltaY * 0.0012));
    redrawRef.current?.();
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={onWheel}
      />
      {hover && (
        <div
          className="absolute pointer-events-none bg-[#0a0e14]/95 border border-[#26303f] rounded px-2 py-1 z-10"
          style={{
            left: Math.min(hover.sx + 8, (wrapRef.current?.clientWidth || 0) - 150),
            top: Math.max(hover.sy - 30, 2),
          }}
        >
          <div className="text-[11px] font-semibold text-white whitespace-nowrap">{hover.name}</div>
          <div className="text-[9px] text-gray-400 whitespace-nowrap">{hover.line}</div>
        </div>
      )}
    </div>
  );
}

/**
 * 3-D UMAP of driver "career fingerprints". Coordinates for every
 * (n_neighbors, min_dist) combination are PRECOMPUTED offline
 * (pipeline/build_umap.py) — the browser only switches between them.
 */
export default function DriverUmap3D({ driver }) {
  const [data, setData] = useState(null);
  const [full, setFull] = useState(false);
  const [nnIdx, setNnIdx] = useState(0);
  const [mdIdx, setMdIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/driver_umap_3d.json")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setData(d);
        const nn = d.params?.n_neighbors ?? [];
        const md = d.params?.min_dist ?? [];
        const dnn = d.default?.n_neighbors, dmd = d.default?.min_dist;
        setNnIdx(Math.max(0, nn.indexOf(dnn)));
        setMdIdx(Math.max(0, md.indexOf(dmd)));
      })
      .catch(() => { if (alive) setData({ drivers: [] }); });
    return () => { alive = false; };
  }, []);

  const points = useMemo(() => {
    if (!data || !data.drivers?.length || !data.embeddings) return data ? [] : null;
    const nn = data.params.n_neighbors[nnIdx];
    const md = data.params.min_dist[mdIdx];
    const emb = data.embeddings[`${nn}_${md}`] || Object.values(data.embeddings)[0];
    return data.drivers.map((d, i) => ({ ...d, x: emb[i][0], y: emb[i][1], z: emb[i][2] }));
  }, [data, nnIdx, mdIdx]);

  if (points && !points.length) {
    return <div className="h-full flex items-center justify-center text-[10px] text-gray-600">UMAP data unavailable.</div>;
  }

  const inCloud = points && points.some((p) => p.driver === driver);

  return (
    <>
      <div className="relative w-full h-full">
        <UmapCanvas points={points} driver={driver} />
        <div className="absolute top-1 left-1 text-[8px] text-gray-500 leading-tight pointer-events-none">
          each dot = a driver · similar careers cluster<br />drag to rotate · scroll to zoom
        </div>
        <button
          onClick={() => setFull(true)}
          className="absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded bg-[#0a0e14]/80 border border-[#26303f] text-gray-300 hover:text-white hover:border-[#e10600] cursor-pointer text-xs"
          title="View fullscreen"
        >
          ⛶
        </button>
        {points && !inCloud && (
          <div className="absolute bottom-1 left-1 text-[8px] text-amber-500/80 pointer-events-none">
            {"<10 races — not in cloud"}
          </div>
        )}
      </div>

      {full && data?.params && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-[#0a0e14]/97 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#26303f]">
            <div>
              <h2 className="text-base font-bold text-white">Driver DNA — 3-D UMAP</h2>
              <p className="text-[11px] text-gray-500">
                Every driver embedded by career fingerprint · highlighting {formatName(driver)}
              </p>
            </div>
            <button
              onClick={() => setFull(false)}
              className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer px-3 py-1"
            >
              ✕
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-h-0">
            <UmapCanvas points={points} driver={driver} big />
          </div>

          {/* Parameter sliders */}
          <div className="border-t border-[#26303f] px-6 py-4 flex flex-col sm:flex-row gap-6 bg-[#0d131c]">
            <ParamSlider
              label="n_neighbors"
              hint="local ↔ global structure"
              values={data.params.n_neighbors}
              idx={nnIdx}
              onChange={setNnIdx}
            />
            <ParamSlider
              label="min_dist"
              hint="tight clusters ↔ even spread"
              values={data.params.min_dist}
              idx={mdIdx}
              onChange={setMdIdx}
            />
            <div className="text-[10px] text-gray-500 self-center max-w-[220px]">
              Sliders switch between embeddings precomputed offline — no UMAP runs in your browser.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ParamSlider({ label, hint, values, idx, onChange }) {
  return (
    <div className="flex-1 min-w-[180px]">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-gray-200 font-mono">{label}</span>
        <span className="text-xs text-[#e10600] font-mono">{values[idx]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#e10600] cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-600">{hint}</span>
      </div>
    </div>
  );
}

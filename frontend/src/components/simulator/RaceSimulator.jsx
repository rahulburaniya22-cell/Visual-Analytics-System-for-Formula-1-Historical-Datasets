import { useEffect, useRef, useState } from "react";
import { getRaceTelemetry, getTrackOutline, getComparisonLapData } from "../../lib/queries";
import { getTeamColor } from "../../constants/f1Colors";
import {
  interpAt,
  standingsAt,
  leaderLapAt,
  timeForLap,
  makeProjector,
} from "./raceEngine";
import TelemetryChart from "./TelemetryChart";
import ComparisonPanel from "./comparison/ComparisonPanel";
import useViewModeStore from "../../store/viewModeStore";

const TWO_PI = Math.PI * 2;

/**
 * Animated race replay for a single race (2018-2024, telemetry available).
 * Canvas renders the track + cars from real position telemetry.
 */
export default function RaceSimulator({ raceId }) {
  const { isMobileView } = useViewModeStore();
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [focused, setFocused] = useState(null);
  const [ui, setUi] = useState({ lap: 1, nLaps: 1, standings: [], atEnd: false });
  // Comparison panel: selected drivers (max 6), race object mirrored into
  // state so it flows through props, and the per-lap rows from the laps table
  const [compare, setCompare] = useState([]);
  const [race, setRace] = useState(null);
  const [lapsRows, setLapsRows] = useState([]);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const raceRef = useRef(null);
  const outlineRef = useRef(null);
  const simTimeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(6);
  const focusedRef = useRef(null);
  const alphaRef = useRef(new Map());
  const xformRef = useRef(null);
  const trackPathRef = useRef(null);
  const startPtRef = useRef(null);
  const dprRef = useRef(1);
  const lastRef = useRef(0);
  const uiAccumRef = useRef(0);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { focusedRef.current = focused; }, [focused]);

  // Load telemetry
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setUnavailable(false);
    setPlaying(false);
    setFocused(null);
    setCompare([]);
    setRace(null);
    setLapsRows([]);
    simTimeRef.current = 0;
    outlineRef.current = null;
    // Laps-table rows load in parallel and never block the replay
    getComparisonLapData(raceId).then((rows) => {
      if (alive) setLapsRows(rows || []);
    });
    Promise.all([getRaceTelemetry(raceId), getTrackOutline(raceId)]).then(
      ([race, outline]) => {
        if (!alive) return;
        if (!race || !race.drivers.length) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        raceRef.current = race;
        setRace(race);
        outlineRef.current = outline;
        alphaRef.current = new Map(race.drivers.map((d) => [d.code, 0]));
        simTimeRef.current = 0;
        setUi({ lap: 1, nLaps: race.nLaps, standings: standingsAt(race.drivers, 0), atEnd: false });
        setLoading(false);
        setPlaying(true);
      }
    );
    return () => { alive = false; };
  }, [raceId]);

  // Canvas sizing + track path
  function rebuild() {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    const race = raceRef.current;
    if (!cv || !wrap || !race) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const w = Math.max(200, rect.width);
    const h = Math.max(200, rect.height);
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + "px";
    cv.style.height = h + "px";

    const outline = outlineRef.current;
    const trackShape =
      outline && outline.x.length
        ? outline
        : { x: race.drivers[0].x.subarray(0, Math.min(100, race.drivers[0].n)),
            y: race.drivers[0].y.subarray(0, Math.min(100, race.drivers[0].n)) };
    const rotation = outline ? outline.rotation : 0;

    const tf = makeProjector([...race.drivers, trackShape], w, h, 34, rotation);
    xformRef.current = tf;

    const path = new Path2D();
    for (let i = 0; i < trackShape.x.length; i++) {
      const [X, Y] = tf.project(trackShape.x[i], trackShape.y[i]);
      if (i === 0) { path.moveTo(X, Y); startPtRef.current = [X, Y]; }
      else path.lineTo(X, Y);
    }
    path.closePath();
    trackPathRef.current = path;
  }

  // Draw one frame
  function draw(dt) {
    const cv = canvasRef.current;
    const race = raceRef.current;
    const tf = xformRef.current;
    if (!cv || !race || !tf) return;
    const ctx = cv.getContext("2d");
    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cv.width / dpr;
    const h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);

    // Track
    if (trackPathRef.current) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#141c28";
      ctx.stroke(trackPathRef.current);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#2b3a4e";
      ctx.stroke(trackPathRef.current);

      if (startPtRef.current) {
        const [sx, sy] = startPtRef.current;
        ctx.fillStyle = "#e8eef5";
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, TWO_PI);
        ctx.fill();
      }
    }

    const t = simTimeRef.current;
    const foc = focusedRef.current;
    const alphas = alphaRef.current;
    const ease = Math.min(1, dt * 6);

    for (const d of race.drivers) {
      const s = interpAt(d, t);
      const target = !s || !s.live || (foc && d.code !== foc) ? 0 : 1;
      const prev = alphas.get(d.code) ?? 0;
      const a = prev + (target - prev) * ease;
      alphas.set(d.code, a);
      d._s = s;
      d._a = a;
    }

    const drawCar = (d) => {
      const s = d._s;
      const a = d._a;
      if (!s || a == null || a < 0.02) return;
      const [X, Y] = tf.project(s.x, s.y);
      const isF = foc === d.code;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(X, Y, isF ? 7 : 5, 0, TWO_PI);
      ctx.fillStyle = getTeamColor(d.team);
      ctx.fill();
      if (isF) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
      ctx.fillStyle = isF ? "#ffffff" : "#c3ced9";
      ctx.font = `${isF ? "bold " : ""}11px ui-sans-serif, system-ui`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(d.code, X + (isF ? 11 : 8), Y);
    };

    for (const d of race.drivers) if (d.code !== foc) drawCar(d);
    if (foc) {
      const fd = race.drivers.find((d) => d.code === foc);
      if (fd) drawCar(fd);
    }
    ctx.globalAlpha = 1;
  }

  function pushUi() {
    const race = raceRef.current;
    if (!race) return;
    const t = simTimeRef.current;
    setUi({
      lap: leaderLapAt(race, t),
      nLaps: race.nLaps,
      standings: standingsAt(race.drivers, t),
      atEnd: t >= race.tEnd - 0.001,
    });
  }

  // Animation loop
  useEffect(() => {
    if (loading || unavailable) return;
    rebuild();
    const ro = new ResizeObserver(() => rebuild());
    if (wrapRef.current) ro.observe(wrapRef.current);

    let raf = 0;
    lastRef.current = performance.now();
    const frame = (now) => {
      const last = lastRef.current || now;
      let dt = (now - last) / 1000;
      lastRef.current = now;
      if (dt > 0.1) dt = 0.1;

      const race = raceRef.current;
      if (race && playingRef.current) {
        let nt = simTimeRef.current + dt * speedRef.current;
        if (nt >= race.tEnd) {
          nt = race.tEnd;
          setPlaying(false);
        }
        simTimeRef.current = nt;
      }

      draw(dt);

      uiAccumRef.current += now - last;
      if (uiAccumRef.current > 110) {
        uiAccumRef.current = 0;
        pushUi();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, unavailable]);

  // Dev-only hook: lets tests force a frame while the tab is backgrounded
  // (requestAnimationFrame is paused for hidden tabs). No effect in production.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__sim = {
      setTime: (t) => { simTimeRef.current = t; },
      setFocus: (code) => setFocused(code),
      setCompare: (codes) => setCompare(codes),
      frame: (dt = 0.25) => { rebuild(); draw(dt); pushUi(); },
    };
    return () => { delete window.__sim; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controls
  function togglePlay() {
    const race = raceRef.current;
    if (race && simTimeRef.current >= race.tEnd - 0.001) {
      simTimeRef.current = 0;
    }
    setPlaying((p) => !p);
  }
  function restart() {
    simTimeRef.current = 0;
    pushUi();
  }
  function seekLap(L) {
    const race = raceRef.current;
    if (!race) return;
    simTimeRef.current = timeForLap(race, L);
    pushUi();
  }
  function selectDriver(code) {
    setFocused((prev) => (prev === code ? null : code));
  }
  function toggleCompare(code) {
    setCompare((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 6
          ? prev
          : [...prev, code]
    );
  }

  const focusedDriver = focused
    ? raceRef.current?.drivers.find((d) => d.code === focused)
    : null;

  if (unavailable) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center p-6">
        <div className="max-w-sm">
          <h3 className="text-lg font-semibold text-gray-300">Replay unavailable</h3>
          <p className="text-sm text-gray-500 mt-2">
            Position telemetry for this race could not be loaded. Animated replays
            are available for 2018-2024.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex gap-3 p-3 min-h-0 ${isMobileView ? "flex-col" : ""}`}>
      {/* Left: canvas + controls + telemetry chart */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div
          ref={wrapRef}
          className="relative flex-1 min-h-0 rounded-xl bg-[#0b111b] border border-[#26303f] overflow-hidden"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              Loading telemetry...
            </div>
          )}
          {focused && (
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-black/50 text-xs text-white flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: getTeamColor(focusedDriver?.team) }}
              />
              Focused: <b>{focused}</b>
              <button
                onClick={() => setFocused(null)}
                className="ml-1 text-gray-300 hover:text-white underline cursor-pointer"
              >
                show all
              </button>
            </div>
          )}
          {race && compare.length > 0 && (
            <ComparisonPanel
              race={race}
              lapsRows={lapsRows}
              compare={compare}
              currentLap={ui.lap}
              nLaps={ui.nLaps}
              onRemoveDriver={toggleCompare}
              onClear={() => setCompare([])}
            />
          )}
        </div>

        {/* Controls */}
        <div className="mt-2 flex flex-col gap-2">
          <div className={`flex items-center ${isMobileView ? "flex-wrap gap-x-3 gap-y-2" : "gap-3"}`}>
            <button
              onClick={togglePlay}
              disabled={loading}
              className="w-10 h-10 rounded-full bg-[#e10600] hover:bg-[#ff1a0d] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 flex-shrink-0"
            >
              {playing ? "❚❚" : ui.atEnd ? "⟲" : "▶"}
            </button>
            <button
              onClick={restart}
              disabled={loading}
              title="Restart"
              className="w-9 h-9 rounded-full bg-[#1b2431] border border-[#26303f] text-gray-300 hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-40 flex-shrink-0"
            >
              ⟲
            </button>

            {/* Lap slider */}
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <span className={`text-xs text-gray-400 whitespace-nowrap ${isMobileView ? "w-16" : "w-20"}`}>
                Lap {ui.lap}/{ui.nLaps}
              </span>
              <input
                type="range"
                min={1}
                max={Math.max(1, ui.nLaps)}
                step={1}
                value={ui.lap}
                onChange={(e) => seekLap(Number(e.target.value))}
                className="flex-1 accent-[#e10600] cursor-pointer"
              />
            </div>

            {/* Speed slider */}
            <div className={`flex items-center gap-2 ${isMobileView ? "w-full" : "w-40"}`}>
              <span className="text-xs text-gray-400 whitespace-nowrap w-10">{speed}x</span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="flex-1 accent-[#e10600] cursor-pointer"
              />
            </div>
          </div>

          {/* Telemetry chart (focused driver only) */}
          {focusedDriver && (
            <div className="rounded-lg bg-[#0b111b] border border-[#26303f] p-2">
              <div className="text-xs text-gray-300 font-medium mb-1">
                {focused} — Throttle &amp; Brake
              </div>
              <TelemetryChart driver={focusedDriver} simTimeRef={simTimeRef} />
            </div>
          )}
        </div>
      </div>

      {/* Right: live standings */}
      <div className={`flex-shrink-0 flex flex-col rounded-xl bg-[#0d1420] border border-[#26303f] overflow-hidden ${
        isMobileView ? "w-full max-h-40" : "w-56"
      }`}>
        <div className="px-3 py-2 border-b border-[#26303f] flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
            Live Order
          </span>
          {focused && (
            <button
              onClick={() => setFocused(null)}
              className="text-[11px] text-[#e10600] hover:underline cursor-pointer"
            >
              show all
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {ui.standings.map((s, i) => {
            const isF = s.code === focused;
            const isC = compare.includes(s.code);
            const dim = focused && !isF;
            return (
              <div
                key={s.code}
                role="button"
                tabIndex={0}
                onClick={() => selectDriver(s.code)}
                onKeyDown={(e) => e.key === "Enter" && selectDriver(s.code)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer border-l-2 transition-colors ${
                  isF ? "bg-[#e10600]/15" : "hover:bg-[#1b2431]"
                } ${dim ? "opacity-40" : ""}`}
                style={{ borderColor: isF || isC ? getTeamColor(s.team) : "transparent" }}
              >
                <span className="w-4 text-xs text-gray-500 text-right">{i + 1}</span>
                <span
                  className="w-1.5 h-4 rounded-sm flex-shrink-0"
                  style={{ background: getTeamColor(s.team) }}
                />
                <span className={`text-sm flex-1 ${isF ? "text-white font-semibold" : "text-gray-200"}`}>
                  {s.code}
                </span>
                <span className="text-[11px] text-gray-500">
                  {s.live ? `L${s.lap}` : "OUT"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCompare(s.code);
                  }}
                  title={isC ? "Remove from comparison" : "Add to comparison"}
                  className={`w-5 h-5 rounded-full text-xs leading-none flex items-center justify-center cursor-pointer border transition-colors ${
                    isC
                      ? "border-[#e10600] text-[#e10600] bg-[#e10600]/10"
                      : "border-[#26303f] text-gray-500 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {isC ? "−" : "+"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-1.5 border-t border-[#26303f] text-[11px] text-gray-500">
          Click to focus · + to compare
        </div>
      </div>
    </div>
  );
}

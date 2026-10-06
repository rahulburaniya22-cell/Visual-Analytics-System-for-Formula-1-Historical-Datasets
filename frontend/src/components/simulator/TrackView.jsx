import { useEffect, useRef, useState } from "react";
import { getTrackOutline } from "../../lib/queries";
import { makeProjector } from "./raceEngine";

/**
 * Static track outline for races without telemetry (pre-2018). Draws the
 * circuit shape if we have an outline for its race_id, otherwise a message.
 * Real coverage is 2018-2024 only (FastF1 has no data before that), so this
 * will legitimately show "no outline" for most pre-2018 races today.
 */
export default function TrackView({ raceId, raceName }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ok | none

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getTrackOutline(raceId).then((poly) => {
      if (!alive) return;
      if (!poly || !poly.x.length) {
        setStatus("none");
        return;
      }
      setStatus("ok");
      const draw = () => {
        const cv = canvasRef.current;
        const wrap = wrapRef.current;
        if (!cv || !wrap) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(200, wrap.clientWidth);
        const h = Math.max(200, wrap.clientHeight);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + "px";
        cv.style.height = h + "px";
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const tf = makeProjector([poly], w, h, 40, poly.rotation || 0);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < poly.x.length; i++) {
          const [X, Y] = tf.project(poly.x[i], poly.y[i]);
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        ctx.closePath();
        ctx.lineWidth = 14;
        ctx.strokeStyle = "#141c28";
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#3a4a5e";
        ctx.stroke();
      };
      draw();
      const ro = new ResizeObserver(draw);
      if (wrapRef.current) ro.observe(wrapRef.current);
      // stash disconnect on the element so cleanup below can reach it
      wrapRef.current && (wrapRef.current._ro = ro);
    });
    return () => {
      alive = false;
      if (wrapRef.current && wrapRef.current._ro) wrapRef.current._ro.disconnect();
    };
  }, [raceId]);

  return (
    <div className="h-full w-full flex flex-col p-3">
      <div
        ref={wrapRef}
        className="relative flex-1 min-h-0 rounded-xl bg-[#0b111b] border border-[#26303f] overflow-hidden flex items-center justify-center"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {status === "loading" && <span className="text-gray-500 text-sm">Loading track…</span>}
        {status === "none" && (
          <div className="text-center max-w-xs px-4">
            <p className="text-sm text-gray-400">No track outline for this circuit.</p>
            <p className="text-xs text-gray-600 mt-1">
              Animated replays and circuit shapes are available for 2018–2024.
            </p>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-gray-600 mt-2">
        {raceName} — track preview (telemetry replay available 2018–2024 only)
      </p>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { channelsAt } from "./raceEngine";

const THROTTLE_COLOR = "#22c55e";
const BRAKE_COLOR = "#ef4444";

/**
 * Scrolling throttle/brake trace for the focused driver.
 * Reads the shared `simTimeRef` every animation frame.
 */
export default function TelemetryChart({ driver, simTimeRef, windowSec = 30, height = 150 }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const driverRef = useRef(driver);
  driverRef.current = driver;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let cssW = 0;
    let cssH = height;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      cssW = Math.max(120, wrap.clientWidth);
      cssH = height;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const PAD_L = 34;
    const PAD_R = 8;
    const PAD_T = 10;
    const PAD_B = 16;

    function draw() {
      const d = driverRef.current;
      const w = cssW;
      const h = cssH;
      const plotW = w - PAD_L - PAD_R;
      const plotH = h - PAD_T - PAD_B;
      const yFor = (pct) => PAD_T + (1 - pct / 100) * plotH;

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "#1b2431";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#5b6b7f";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const pct of [0, 50, 100]) {
        const y = yFor(pct);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(w - PAD_R, y);
        ctx.stroke();
        ctx.fillText(pct + "%", PAD_L - 5, y);
      }

      if (!d) return;

      const now = simTimeRef.current;
      const t0 = now - windowSec;

      const N = Math.max(2, Math.floor(plotW));
      let throttlePts = [];
      let brakePts = [];
      ctx.lineWidth = 2;

      for (let i = 0; i <= N; i++) {
        const tt = t0 + (i / N) * windowSec;
        const s = channelsAt(d, tt);
        const px = PAD_L + (i / N) * plotW;
        if (s) {
          throttlePts.push([px, yFor(s.throttle)]);
          brakePts.push([px, yFor(s.brake > 0 ? 100 : 0)]);
        } else {
          throttlePts.push(null);
          brakePts.push(null);
        }
      }

      const strokeLine = (pts, color) => {
        ctx.beginPath();
        let pen = false;
        for (const p of pts) {
          if (!p) { pen = false; continue; }
          if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; }
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      strokeLine(brakePts, BRAKE_COLOR);
      strokeLine(throttlePts, THROTTLE_COLOR);

      ctx.strokeStyle = "#3a4a5e";
      ctx.beginPath();
      ctx.moveTo(w - PAD_R, PAD_T);
      ctx.lineTo(w - PAD_R, PAD_T + plotH);
      ctx.stroke();
    }

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, windowSec, simTimeRef]);

  return (
    <div ref={wrapRef} className="w-full">
      <div className="flex items-center gap-4 px-1 pb-1 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px]" style={{ background: THROTTLE_COLOR }} />
          Throttle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px]" style={{ background: BRAKE_COLOR }} />
          Brake
        </span>
        <span className="ml-auto text-gray-500">last {windowSec}s</span>
      </div>
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
    </div>
  );
}

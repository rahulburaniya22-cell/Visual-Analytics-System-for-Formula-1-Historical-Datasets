import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const TOTAL_MS = 2200;
const AUDIO_START_S = 0.5;
const FADE_OUT_MS = 600;

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("enter"); // enter | zoom | done

  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    let cancelled = false;
    let gainNode = null;
    let audioCtx = null;
    let source = null;

    async function playAudio() {
      try {
        // Web Audio API has better autoplay support than HTMLAudioElement
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // If context is suspended (autoplay blocked), try to resume
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }

        const resp = await fetch("/introsound.mp3");
        const buf = await resp.arrayBuffer();
        if (cancelled) return;

        const decoded = await audioCtx.decodeAudioData(buf);
        if (cancelled) return;

        gainNode = audioCtx.createGain();
        gainNode.gain.value = 1;
        gainNode.connect(audioCtx.destination);

        source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(gainNode);
        source.start(0, AUDIO_START_S);

        // Schedule volume fade
        const fadeStart = audioCtx.currentTime + (TOTAL_MS - FADE_OUT_MS) / 1000;
        const fadeEnd = fadeStart + FADE_OUT_MS / 1000;
        gainNode.gain.setValueAtTime(1, fadeStart);
        gainNode.gain.linearRampToValueAtTime(0, fadeEnd);
      } catch {
        // Audio failed — splash still plays visually
      }
    }

    // If AudioContext is blocked, unlock on first gesture
    function unlockAndPlay() {
      playAudio();
      document.removeEventListener("click", unlockAndPlay, true);
      document.removeEventListener("keydown", unlockAndPlay, true);
      document.removeEventListener("touchstart", unlockAndPlay, true);
    }

    // Try to play immediately
    playAudio().then(() => {
      if (audioCtx && audioCtx.state === "suspended") {
        // Still blocked — wait for user gesture
        document.addEventListener("click", unlockAndPlay, true);
        document.addEventListener("keydown", unlockAndPlay, true);
        document.addEventListener("touchstart", unlockAndPlay, true);
      }
    });

    const t1 = setTimeout(() => setPhase("zoom"), 700);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.();
    }, TOTAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      document.removeEventListener("click", unlockAndPlay, true);
      document.removeEventListener("keydown", unlockAndPlay, true);
      document.removeEventListener("touchstart", unlockAndPlay, true);
      if (source) try { source.stop(); } catch {}
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        @keyframes f1-enter {
          0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 0; }
          60%  { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
        @keyframes f1-zoom {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(30);  opacity: 0; }
        }
        @keyframes overlay-fade {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#0a0e14",
          animation: phase === "zoom"
            ? `overlay-fade ${TOTAL_MS - 700}ms ease-in forwards`
            : "none",
          pointerEvents: "none",
        }}
      />

      <img
        src="/f1.svg"
        alt="F1"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          width: "220px",
          height: "220px",
          zIndex: 10000,
          filter: "drop-shadow(0 0 40px rgba(225,6,0,0.6))",
          willChange: "transform, opacity",
          animation: phase === "enter"
            ? "f1-enter 0.65s cubic-bezier(0.22,1,0.36,1) forwards"
            : `f1-zoom ${TOTAL_MS - 700}ms cubic-bezier(0.55,0,1,0.45) forwards`,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

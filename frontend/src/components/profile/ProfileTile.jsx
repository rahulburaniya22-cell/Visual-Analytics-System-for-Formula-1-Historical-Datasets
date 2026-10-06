import React, { useState } from "react";

/**
 * A single dashboard tile with an optional multi-page carousel.
 *
 * Props:
 *   title: string
 *   accent: team colour (string) used for the title underline / dots
 *   pages: ReactNode[]  — one entry per sub-tile; arrows appear when >1
 *   icon: optional ReactNode shown left of the title
 */
export default function ProfileTile({ title, accent = "#e10600", pages = [], icon = null }) {
  const [idx, setIdx] = useState(0);
  const count = pages.length;
  const safeIdx = Math.min(idx, Math.max(0, count - 1));

  const go = (delta) => setIdx((i) => (i + delta + count) % count);

  return (
    <div className="relative flex flex-col min-h-0 h-full bg-[#121822]/80 border border-[#26303f] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#26303f] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3
            className="text-[11px] font-semibold uppercase tracking-wider truncate"
            style={{ color: accent }}
          >
            {title}
          </h3>
        </div>
        {count > 1 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => go(-1)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer text-xs"
              aria-label="Previous"
            >
              ‹
            </button>
            <div className="flex gap-1">
              {pages.map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: i === safeIdx ? accent : "#3a4658" }}
                />
              ))}
            </div>
            <button
              onClick={() => go(1)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer text-xs"
              aria-label="Next"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden p-3">
        {pages[safeIdx]}
      </div>
    </div>
  );
}

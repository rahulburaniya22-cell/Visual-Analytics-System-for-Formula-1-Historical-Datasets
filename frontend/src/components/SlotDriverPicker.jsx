import { useEffect, useRef, useState } from "react";
import { getTeamColor } from "../constants/f1Colors";
import useViewModeStore from "../store/viewModeStore";

/**
 * SlotDriverPicker
 * Dropdown for swapping drivers in/out of chart slots.
 * Opens when you click a driver's name in PositionChart or PitStopGantt.
 */
export default function SlotDriverPicker({ picker, allDrivers, slots, driverMeta, onPick, onClose }) {
  const { isMobileView } = useViewModeStore();
  const rootRef = useRef(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    }
    function onEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className={`absolute z-30 max-h-72 overflow-auto rounded-lg border border-white/15 bg-[#0d0d0d]/95 backdrop-blur-sm shadow-2xl shadow-black/60 py-1 transition-all duration-150 ease-out ${
        isMobileView ? "w-48 max-w-[85vw]" : "w-56"
      } ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
      style={{ left: picker.x + 10, top: Math.max(4, picker.y - 8) }}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-white/10">
        Swap {picker.driver} for…
      </div>
      {allDrivers.map((driver) => {
        const onTrack = slots.includes(driver);
        const isSelf = driver === picker.driver;
        return (
          <button
            key={driver}
            type="button"
            disabled={isSelf}
            onClick={() => onPick(driver)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent ${
              isSelf ? "text-gray-500" : "text-gray-200"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: getTeamColor(driverMeta[driver]?.team) }}
            />
            <span className="truncate">{driver}</span>
            {isSelf ? (
              <span className="ml-auto text-[9px] text-gray-600 tracking-wide">CURRENT</span>
            ) : onTrack ? (
              <span className="ml-auto text-[9px] font-semibold text-[#e10600] tracking-wide">SWAP</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

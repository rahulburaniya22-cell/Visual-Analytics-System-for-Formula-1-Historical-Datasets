import React from "react";
import useViewModeStore from "../store/viewModeStore";

/**
 * Explicit desktop/mobile switch, independent of actual window width.
 * Desktop is the default, original experience; Mobile is an opt-in
 * preview of the touch-friendly layout (for phones or demoing).
 */
export default function ViewModeToggle() {
  const { isMobileView, setMobileView } = useViewModeStore();

  return (
    <div className="fixed top-3 right-3 z-[200] flex items-center rounded-full border border-[#26303f] bg-[#121822]/90 backdrop-blur-sm shadow-lg overflow-hidden text-xs font-medium">
      <button
        onClick={() => setMobileView(false)}
        className={`px-3 py-1.5 cursor-pointer transition-colors ${
          !isMobileView ? "bg-[#e10600] text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        🖥 Desktop
      </button>
      <button
        onClick={() => setMobileView(true)}
        className={`px-3 py-1.5 cursor-pointer transition-colors ${
          isMobileView ? "bg-[#e10600] text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        📱 Mobile
      </button>
    </div>
  );
}

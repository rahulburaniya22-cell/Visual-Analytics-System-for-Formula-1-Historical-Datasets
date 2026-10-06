import { create } from "zustand";

const STORAGE_KEY = "f1-view-mode";

function loadInitial() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "mobile";
}

// Explicit desktop/mobile switch — NOT tied to actual viewport width.
// Desktop (the default) always renders the original layout; mobile view
// is an opt-in the user flips on to preview the touch-friendly version.
const useViewModeStore = create((set) => ({
  isMobileView: loadInitial(),
  setMobileView: (isMobileView) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, isMobileView ? "mobile" : "desktop");
    }
    set({ isMobileView });
  },
}));

export default useViewModeStore;

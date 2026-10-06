import { create } from "zustand";

const useFilterStore = create((set) => ({
  season: 2024,
  raceId: null,
  selectedDrivers: [],
  seasonRange: { start: 2000, end: 2024 },

  setSeason: (season) => set({ season }),
  setRaceId: (raceId) => set({ raceId }),
  setSelectedDrivers: (selectedDrivers) => set({ selectedDrivers }),
  setSeasonRange: (seasonRange) => set({ seasonRange }),
}));

export default useFilterStore;

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import RacePage from "./pages/RacePage";
import ViewModeToggle from "./components/ViewModeToggle";

export default function App() {
  return (
    <BrowserRouter>
      <ViewModeToggle />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/race/:season/:raceId" element={<RacePage />} />
      </Routes>
    </BrowserRouter>
  );
}

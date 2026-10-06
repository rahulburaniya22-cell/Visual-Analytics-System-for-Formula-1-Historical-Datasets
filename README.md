# CS661 F1 Visual Analytics — StratViz

An F1 visual analytics web app built for CS661 (Big Data Visual Analytics). The app runs entirely in the browser — no backend server. Data is queried from Parquet files hosted on HuggingFace using DuckDB-WASM (SQL engine compiled to WebAssembly).

**Live site:** https://cs-661-f1-strat-viz.vercel.app/
**Data:** https://huggingface.co/datasets/Aman2406/f1-visual-analytics
**Repo:** https://github.com/DakshSaijwal/CS661-F1-StratViz

---

## Quick Start (run locally)

```bash
cd frontend
npm install
npx vite
```

Open http://localhost:5173 in your browser. That's it — data is fetched from HuggingFace automatically.

**Requirements:** Node.js 18+ (check with `node --version`)

---

## App Structure (2 Pages)

### Page 1 — `/` — World Map Landing

Full-screen interactive D3 world map showing race circuit locations as red pins.

- **Year selector** (fixed floating bar at top): Shows 7 years at a time from 2000-2024, arrows to scroll. Clicking a year loads that season's race pins on the map.
- **"Over the Years" button**: In the top bar. Opens a large modal with `EraBumpChart` — historical end-of-season championship rank (2000-2024). Toggle between drivers/constructors view, multi-select filter with search. Scroll to zoom into a season range, drag to pan, double-click to reset to full view. Chart only appears after selecting entities. Data fetched via `getEraStandings()`.
- **Zoom & Pan**: Pinch-to-zoom (trackpad/touch) + scroll wheel zoom. Double-click to re-center on a point.
- **Country hover effect**: Countries highlight with a warm crimson tint + red border on hover, matching the F1 theme.
- **Race pins**: Hovering shows circuit outline image + race name tooltip. Clicking navigates to Page 2.
- **Splash screen**: Animated intro on first visit (once per session).
- **Championship Progress panel** (fixed, bottom-left): Shows a collapsed title card by default. On hover, expands to reveal the full `ChampionshipChart` showing top 7 drivers by final points with cumulative points across rounds. Click any driver chip to swap via dropdown picker (same pattern as Tire Strategy). Data fetched via `getChampionshipStandings(season)`.
- **Data source**: `src/constants/raceLocations.json` (static, 38 circuits with lat/lng coordinates).

### Page 2 — `/race/:season/:raceId` — Race Detail

Three regions:

1. **Left Panel (Leaderboard)**: Full race classification — position, driver name, team, points, DNF status. Podium finishers (P1-P3) shown with full driver headshot photos and team-colored names. Team logos displayed alongside each entry. **Clicking any row opens that driver's full profile in the center pane** (see Driver Profile below). Data fetched live via `getRaceLeaderboard()`.

2. **Center (Race Simulator OR Driver Profile)**: By default shows the canvas-based animated race replay using real telemetry data (2018-2024). When a driver is clicked in the leaderboard, this pane is replaced by the **Driver Profile** (a "← Telemetry" button returns to the simulator). Simulator features:
   - Track outline rendered from circuit geometry with proper rotation
   - All 20 drivers shown as colored dots moving in real-time along the track
   - Play/pause, restart, lap scrubber, and speed control (1x-30x)
   - Click any driver (in standings or on track) to focus — dims others, shows telemetry chart
   - Live standings sidebar updates in real-time during playback
   - Throttle & brake trace chart for focused driver (scrolling canvas)
   - **Multi-driver comparison panel**: Click the small **+/−** button on up to 6 driver rows in the standings to add them to a comparison. A pill appears over the canvas that expands into a floating panel on hover (📌 to pin it open) — the replay keeps running behind it. Three tabs, all filling in live as the sim clock advances:
     - **Pace** — lap-time sparklines per driver, switchable to approximate sector times (track thirds derived from telemetry, not official timing sectors) or a 5-lap rolling stint-pace average. Pit/anomalous laps render as hollow markers off the line, with a toggle to include them.
     - **Dynamics** — a position bump chart (P1 on top) plus a gap chart with a switchable baseline (gap to leader, or gap to any compared driver).
     - **Scatter** — relationship plots (lap time, tyre age, avg/top speed, corner-type speed, position, lap number) with X/Y metric dropdowns, up to 3 side-by-side charts you can add/remove, and hover tooltips showing driver/lap/compound.
     - Uses the official `laps` table for 2022-2024 races; for 2018-2021 races (telemetry exists but `laps` has no rows) the same stats are derived client-side from telemetry, flagged with an "approx. data" badge, and tyre-age-based metrics are disabled.
   - Auto-plays on load. Shows "Replay unavailable" for races without telemetry data
   - **Pre-2018 races**: Shows a static `TrackView` component (track outline preview) instead of live simulator
   - Data: `telemetry.parquet` (X/Y/speed/throttle/brake, 100 samples/lap) + `circuits.parquet` (track shape)

3. **Bottom (Toggle Panels)**: Three buttons — only one panel open at a time (full-height, scrollable):
   - **Tire Strategy** — WORKING, `PitStopGantt` Gantt chart with animated playback, driver swap picker, compound-colored bars, evolving tire percentage labels on each stint bar showing share of race completed. Default drivers are top finishers. Percentages persist at end of race until replay.
   - **Lap-by-Lap Position** — WORKING, `PositionChart` animated D3 bump chart with play/pause, 5-driver comparison chips, pit stop markers, compound color bands. Chart height scales dynamically with number of positions. Default drivers are top 5 finishers (sorted by final race position).
   - **Strategic Archetypes** — WORKING, `ParallelCoordinates` parallel coordinates plot of stint strategy (avg lap time, compound, stint length, tire age, grid position) with brush filtering

### Driver Profile (center pane, opened from the leaderboard)

Clicking any driver in the Page 2 leaderboard swaps the center pane for a single-screen (no-scroll) driver profile laid out as a **3×2 grid of six tiles**. Tiles with more than one view expose ‹ › arrow buttons and dot indicators to page between charts. The whole profile is tinted with the driver's **race-weekend** team color (so 2006 Alonso reads as Renault, not his latest team), and a "← Telemetry" button returns to the simulator. Data is loaded in parallel via the `getDriver*` query functions.

1. **Overview** — Large edge-to-edge headshot + team logo, plus a career stat grid: races, wins, podiums, poles, points, championship **titles** (`COUNT(DISTINCT season)` so no duplicate-row inflation), best finish, fastest laps, avg finish, seasons.
2. **At {Circuit}** — The driver's career record at *this* race's circuit: summary stats + a finish-position trend line across every appearance.
3. **{Season} Season** — This season's points progression, race-by-race finishing positions, and a results list.
4. **Career Trajectory** — Championship position per season (line), points per season (bar), and wins per season (bar).
5. **Circuit Mastery** — Best circuits by average finish (horizontal bar) + a finish-position distribution histogram.
6. **Driver DNA · 3-D UMAP** — An interactive **precomputed 3-D UMAP** of every driver's career "style fingerprint" (drivers with similar careers cluster together), plus a career-rate radar chart on a second page. Drag to rotate, scroll to zoom, and open **fullscreen** for a larger canvas with live sliders for the two UMAP hyper-parameters (`n_neighbors`, `min_dist`) — the browser switches between 16 precomputed embeddings; no UMAP is ever run client-side.

---

## Project Structure

```
├── frontend/                        # React + Vite app (deployed to Vercel)
│   ├── index.html                   # HTML entry point
│   ├── vite.config.js               # Vite config (React + Tailwind plugins)
│   ├── package.json                 # Dependencies: react, d3, recharts, duckdb-wasm, etc.
│   ├── vercel.json                  # SPA rewrite (all routes → index.html) so deep links
│   │                                #   like /race/2023/2023_1 don't 404 on refresh
│   └── src/
│       ├── main.jsx                 # React entry — mounts <App /> to #root
│       ├── App.jsx                  # Router: "/" → LandingPage, "/race/:season/:raceId" → RacePage
│       ├── index.css                # Tailwind import + dark theme globals (#0a0a0a bg)
│       │
│       ├── lib/                     # DATA LAYER — the "backend" (runs in browser)
│       │   ├── duckdb.js            # Initializes DuckDB-WASM singleton, fetches 4 parquet
│       │   │                        #   files from HuggingFace, registers as SQL views.
│       │   │                        #   Exports: getConnection(), query(sql), queryArrow(sql),
│       │   │                        #   registerParquet(), registerHttpParquet(), unregisterFile()
│       │   └── queries.js           # 28 exported async functions — each runs SQL via
│       │                            #   DuckDB and returns plain JS array of objects.
│       │                            #   This is the "API" all components call.
│       │
│       ├── components/
│       │   ├── WorldMap.jsx         # D3 world map with race pins + zoom/pan
│       │   │                        #   Country hover highlight, circuit image tooltips
│       │   ├── SplashScreen.jsx     # Animated intro splash (once per session)
│       │   ├── SlotDriverPicker.jsx # Shared driver swap dropdown for charts
│       │   │
│       │   ├── charts/              # VISUALIZATION COMPONENTS
│       │   │   ├── ChampionshipChart.jsx  # Recharts cumulative points line chart (top 7 drivers,
│       │   │   │                          #   slot-based driver swap picker)
│       │   │   ├── EraBumpChart.jsx       # Recharts bump chart: end-of-season rank 2000-2024
│       │   │   │                          #   Driver/constructor toggle, multi-select filter,
│       │   │   │                          #   scroll-to-zoom, drag-to-pan, double-click reset
│       │   │   ├── PositionChart.jsx      # D3 animated position bump chart (5 drivers,
│       │   │   │                          #   play/pause, compound bands, pit markers)
│       │   │   │                          #   Self-contained: fetches via getPositionChartData()
│       │   │   ├── PitStopGantt.jsx       # SVG Gantt chart of tire stints (5 drivers,
│       │   │   │                          #   play/pause, compound colors, driver swap)
│       │   │   │                          #   Self-contained: fetches via getPitStopGanttData()
│       │   │   └── ParallelCoordinates.jsx # D3 parallel coordinates for stint strategy
│       │   │                              #   (brushable axes, compound-colored lines)
│       │   │                              #   Self-contained: fetches via getStintStrategyData()
│       │   │
│       │   │
│       │   ├── simulator/           # RACE SIMULATOR
│       │   │   ├── RaceSimulator.jsx    # Canvas-based animated race replay (20 drivers,
│       │   │   │                        #   track + cars, live standings, focus mode, compare)
│       │   │   │                        #   Self-contained: fetches via getRaceTelemetry()
│       │   │   ├── TelemetryChart.jsx   # Scrolling throttle/brake canvas trace for
│       │   │   │                        #   focused driver (synced to sim clock via ref)
│       │   │   ├── TrackView.jsx        # Static track outline for pre-2018 races
│       │   │   ├── raceEngine.js        # Pure math: interpolation, standings, projection.
│       │   │   │                        #   No React — used by RaceSimulator + TelemetryChart
│       │   │   └── comparison/          # Multi-driver comparison overlay
│       │   │       ├── ComparisonPanel.jsx   # Floating panel with tabs
│       │   │       ├── PaceChart.jsx         # Lap time comparison chart
│       │   │       ├── DynamicsCharts.jsx    # Speed/throttle/brake dynamics
│       │   │       ├── MetricScatter.jsx     # Performance metric scatter plot
│       │   │       ├── CompareTooltip.jsx    # Shared tooltip component
│       │   │       └── comparisonData.js     # Data fetching helpers
│       │   │
│       │   ├── profile/            # DRIVER PROFILE (center pane, opened from leaderboard)
│       │   │   ├── DriverProfile.jsx    # 3×2 grid of 6 tiles (overview, circuit,
│       │   │   │                        #   season, career, mastery, 3-D UMAP + radar)
│       │   │   │                        #   Fetches via the getDriver* query functions
│       │   │   ├── ProfileTile.jsx      # Reusable tile shell: title, accent, paged
│       │   │   │                        #   views with ‹ › arrows + dot indicators
│       │   │   └── DriverUmap3D.jsx      # Canvas 3-D UMAP (drag-rotate, scroll-zoom,
│       │   │                             #   fullscreen w/ n_neighbors + min_dist sliders)
│       │   │                             #   Reads precomputed /driver_umap_3d.json
│       │   │
│       │   ├── TeamLogo.jsx          # Real team logo, or monogram badge fallback
│       │   ├── FallbackImage.jsx    # <img> with multiple source fallbacks on error
│       │   │
│       │   └── layout/              # SHARED UI COMPONENTS
│       │       ├── Navbar.jsx           # Top nav (currently unused in 2-page layout)
│       │       ├── FilterBar.jsx        # Season dropdown, reads/writes Zustand store
│       │       ├── StatCard.jsx         # Animated stat card (label + value + subtext)
│       │       └── LoadingSkeleton.jsx  # Pulsing placeholder while data loads
│       │
│       ├── pages/
│       │   ├── LandingPage.jsx      # "/" — World map + year selector + race pins
│       │   └── RacePage.jsx         # "/race/:season/:raceId" — Leaderboard + simulator
│       │                            #   + toggle panels
│       │
│       ├── store/
│       │   └── filterStore.js       # Zustand store: season, raceId, selectedDrivers,
│       │                            #   seasonRange + setter functions
│       │
│       └── constants/
│           ├── f1Colors.js          # Team color hex codes (Red Bull #3671C6, etc.)
│           │                        #   + compound colors (SOFT #E8002D, etc.)
│           │                        #   Exports: TEAM_COLORS, COMPOUND_COLORS, getTeamColor()
│           ├── teamAssets.js        # Team logo paths + driver headshot filename mappings
│           │                        #   Exports: getTeamLogo(), getTeamLogoScale(),
│           │                        #   getDriverImageCandidates()
│           └── raceLocations.json   # Static JSON: 38 circuits with lat/lng + races per
│                                    #   year (2000-2024). Used by WorldMap to place pins.
│
├── pipeline/                        # DATA PIPELINE (Python, run separately, not needed for frontend)
│   ├── fetch_jolpica.py             # Fetches from Jolpica API (Ergast replacement), 2000-2024
│   ├── fetch_fastf1.py              # Fetches lap telemetry via FastF1 library, 2018-2024
│   ├── fetch_telemetry.py           # Fetches race replay data: telemetry (X/Y/speed/
│   │                                #   throttle/brake/t), track status, circuit geometry
│   ├── fetch_telemetry_colab.ipynb  # Google Colab notebook for fast telemetry download
│   │                                #   (uses Google datacenter network, ~30-60 min)
│   ├── upload_telemetry_to_hf.py    # Pushes local telemetry/circuits/track_status parquet
│   │                                #   to the HuggingFace dataset (run `hf auth login` first)
│   ├── build_umap.py                # Precomputes the 3-D driver "style fingerprint" UMAP:
│   │                                #   16 embeddings (n_neighbors × min_dist grid) →
│   │                                #   frontend/public/driver_umap_3d.json
│   └── build_parquets.py            # Cleans and exports final .parquet files
│
├── run_pipeline.py                  # Entry point for full pipeline
├── generate_placeholder.py          # Generates mock parquet files (not needed anymore)
├── requirements.txt                 # Python deps: pandas, pyarrow, fastf1, requests
└── .gitignore
```

---

## Architecture

```
User's Browser
    │
    ├── React Pages (LandingPage, RacePage)
    │       │
    │       ▼
    ├── queries.js  ← "API layer" — 28 async functions returning JS arrays
    │       │
    │       ▼
    ├── duckdb.js   ← DuckDB-WASM (full SQL engine running in browser)
    │       │
    │       ▼
    └── Fetches 4 core .parquet files on first load (~3MB total)
        + lazy-loads telemetry.parquet & circuits.parquet via HTTP range requests
          (only fetches the byte ranges needed for the viewed race)
```

No server. No API calls to a backend. SQL runs client-side in WebAssembly.

---

## Data Layer API (queries.js)

All functions are async and return plain JS arrays/objects (28 total). Import what you need:

```js
import { getChampionshipStandings, getRaceLeaderboard } from '../lib/queries';
const standings = await getChampionshipStandings(2023);
const leaderboard = await getRaceLeaderboard(2023, 1);
```

### Function Reference

| Function | Params | Returns |
|---|---|---|
| `getChampionshipStandings(season)` | `2023` | `[{ driver, team, round, cumulative_points }]` |
| `getEraStandings()` | none | `[{ season, driver, team, position }]` (end-of-season standings, 2000-2024) |
| `getConstructorHeatmap(season)` | `2023` | `[{ constructor, round, points }]` |
| `getRaceOutcomesGrid(season)` | `2023` | `[{ round, position, driver, team, dnf }]` |
| `getSeasonStatCards(season)` | `2023` | `{ champion, race_count, constructor_champion, fastest_lap_holder }` |
| `getRaceList(season)` | `2023` | `[{ round, race_name, circuit_name, country, date }]` |
| `getPositionChartData(raceId)` | `"2023_1"` | `[{ driver, team, lap_number, position, compound, pit_flag }]` |
| `getLapTimeScatterData(raceId)` | `"2023_1"` | `[{ driver, team, lap_number, lap_time_seconds, compound, is_pit_lap }]` |
| `getGapToLeaderData(raceId)` | `"2023_1"` | `[{ driver, team, lap_number, gap_to_leader_seconds }]` |
| `getPitStopGanttData(raceId)` | `"2023_1"` | `[{ driver, stint_number, compound, start_lap, end_lap, stint_length }]` |
| `getDriverRadarStats(d1, d2, range)` | `"max_verstappen", "hamilton", {start:2022, end:2024}` | `{ driver1: {avg_qualifying_position, avg_race_position, win_rate, podium_rate, points_per_race, fastest_lap_rate}, driver2: {...} }` |
| `getQualVsRaceScatter(range)` | `{start:2020, end:2024}` | `[{ driver, season, avg_qualifying_position, avg_race_position, team }]` |
| `getCircuitHeatmapForDriver(driver)` | `"max_verstappen"` | `[{ circuit_name, season, avg_finish_position }]` |
| `getTeammateBattle(team, season)` | `"Red Bull", 2023` | `[{ round, driver1, driver2, quali_delta, race_position_delta }]` |
| `getDriverList(range)` | `{start:2022, end:2024}` | `[{ driver, team }]` |
| `getTeamList(season)` | `2023` | `[{ constructor }]` |
| `getRaceLeaderboard(season, round)` | `2023, 1` | `[{ position, driver, team, points, status }]` |
| `getStintStrategyData(raceId)` | `"2023_1"` | `[{ stint_id, driver, avg_lap_time, compound, stint_length, tire_age_at_end, starting_position }]` |
| `getRaceTelemetry(raceId)` | `"2023_1"` | `{ drivers: [{ code, team, n, t, x, y, throttle, brake, speed }], tEnd, nLaps, lapStartT }` (or null) |
| `getTrackOutline(raceId)` | `"2023_1"` | `{ x: Float32Array, y: Float32Array, rotation: number }` (or null) |
| `getComparisonLapData(raceId)` | `"2023_1"` | `[{ driver, team, lap_number, position, compound, lap_time_seconds, gap_to_leader_seconds, tire_age_laps, is_pit_lap }]` — all drivers/laps in one call, for the simulator's comparison panel. `[]` for 2018-2021 races (no `laps` rows), which is the fallback-to-derived-stats signal. |
| `getRaceCircuit(season, round)` | `2006, 4` | `{ circuit_name, race_name }` |
| `getDriverCareerStats(driver)` | `"alonso"` | `{ races, wins, podiums, poles, points, fastest_laps, dnfs, avg_finish, avg_grid, best_finish, first_season, last_season, seasons, titles, team }` (single object; `titles` via `COUNT(DISTINCT season)`) |
| `getDriverCircuitHistory(driver, circuitName)` | `"alonso", "Circuit de..."` | `[{ season, finish_position, grid_position, points, team, status }]` (one row per appearance at that circuit) |
| `getDriverSeasonPerformance(driver, season)` | `"alonso", 2006` | per-round finishing positions + points for that season |
| `getDriverSeasonHistory(driver)` | `"alonso"` | per-season summary (championship position, points, wins) for the career-trajectory charts |
| `getDriverCircuitAverages(driver)` | `"alonso"` | `[{ circuit_name, avg_finish, ... }]` — best circuits by average finish |
| `getDriverFinishDistribution(driver)` | `"alonso"` | histogram of finishing positions |

### Key conventions
- **`season`** — integer, e.g. `2023`
- **`raceId`** — string `"YYYY_R"`, e.g. `"2023_1"` (season underscore round)
- **`seasonRange`** — object `{ start: 2020, end: 2024 }` (inclusive both ends)
- **`driver`** — Jolpica-style ID: `max_verstappen`, `hamilton`, `leclerc`
- **`constructor`** — display name: `Red Bull`, `Mercedes`, `Ferrari`, `McLaren`
- **Laps/stints data** — only available for 2018-2024 (FastF1 source)
- **Results/standings** — available for 2000-2024 (Jolpica source)

---

## What Needs to Be Built Next

- Fetch the full 2018-2024 telemetry set (`python pipeline/fetch_telemetry.py --out frontend/public`, ~2-4 hrs) and upload it with `python pipeline/upload_telemetry_to_hf.py` — only 2023 Bahrain (`2023_1`) has real telemetry on HuggingFace right now, so every other 2018-2024 race shows "Replay unavailable" until this runs
- Add more race info to RacePage header (circuit name, date, country)
- Safety car / VSC overlays on simulator timeline (data already fetched into `track_status.parquet`, just not queried/rendered yet)

---

## Adding a New Visualization

1. Create chart component in `frontend/src/components/charts/YourChart.jsx`
2. Import the relevant query function from `../../lib/queries`
3. Use this pattern:

```jsx
import { useState, useEffect } from 'react';
import { getSomeData } from '../../lib/queries';
import LoadingSkeleton from '../layout/LoadingSkeleton';

export default function YourChart({ raceId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSomeData(raceId).then(d => { setData(d); setLoading(false); });
  }, [raceId]);

  if (loading) return <LoadingSkeleton />;

  return (
    // Your chart rendering here using `data`
  );
}
```

4. Wire it into `RacePage.jsx` in the appropriate toggle panel (replace the placeholder div)

---

## Available Data (on HuggingFace)

| File | Rows | Years | Source | Key columns |
|------|------|-------|--------|-------------|
| standings.parquet | 11,925 | 2000-2024 | Jolpica API | season, round, driver, constructor, points, cumulative_points, position |
| results.parquet | 10,071 | 2000-2024 | Jolpica API | season, round, race_name, circuit_name, country, date, driver, constructor, grid_position, finish_position, points, status, fastest_lap_rank, num_pit_stops, avg_pit_stop_duration_ms |
| laps.parquet | 161,794 | 2018-2024 | FastF1 | race_id, season, round, driver, team, lap_number, lap_time_seconds, position, compound, tire_age_laps, pit_in_flag, pit_out_flag, gap_to_leader_seconds, sector1_time, sector2_time, sector3_time |
| stints.parquet | 7,101 | 2018-2024 | Derived | race_id, driver, stint_number, compound, start_lap, end_lap, stint_length |
| telemetry.parquet | ~20M | 2018-2024 | FastF1 | race_id, driver, lap_number, sample_index, x, y, distance, speed, throttle, brake, t (100 pts/lap, sorted by race_id for HTTP range reads) |
| track_status.parquet | ~3,000 | 2018-2024 | FastF1 | race_id, time_seconds, status_code, status (Green/SafetyCar/VSC/Red) |
| circuits.parquet | ~30,000 | 2018-2024 | FastF1 | race_id, circuit_name, rotation, point_index, x, y, distance (200 pts/circuit) |

Data URL pattern: `https://huggingface.co/datasets/Aman2406/f1-visual-analytics/resolve/main/data/{filename}.parquet`

---

## F1 Color Constants (`src/constants/f1Colors.js`)

**Team colors:**
Red Bull `#3671C6`, Mercedes `#27F4D2`, Ferrari `#E8002D`, McLaren `#FF8000`,
Aston Martin `#358C75`, Alpine `#FF87BC`, Williams `#64C4FF`, AlphaTauri `#6692FF`,
Alfa Romeo `#C92D4B`, Haas `#B6BABD`

**Tire compounds:**
SOFT `#E8002D`, MEDIUM `#FFF200`, HARD `#FFFFFF`, INTERMEDIATE `#39B54A`, WET `#0067FF`

Usage: `import { getTeamColor, COMPOUND_COLORS } from '../constants/f1Colors'`

---

## Running the Data Pipeline (optional)

Only needed if you want to regenerate or update the parquet data. Not required for frontend work.

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run_pipeline.py
```

Takes ~40 minutes on first run. Subsequent runs use cache and are much faster.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, D3.js, Recharts, Framer Motion, Zustand
- **Data:** DuckDB-WASM (SQL in browser), Parquet files on HuggingFace
- **Map:** D3 + TopoJSON (Natural Earth projection) with pinch-to-zoom and pan
- **Pipeline:** Python, pandas, FastF1, requests; scikit-learn + umap-learn for the precomputed 3-D driver UMAP (`driver_umap_3d.json`)
- **Deployment:** Vercel (auto-deploys from main branch, root directory: `frontend`)

/**
 * Pure data derivation for the multi-driver comparison panel. No React.
 *
 * Two sources are merged per race:
 *  - telemetry arrays from getRaceTelemetry() — 100 distance-even samples per
 *    lap, so lap L of driver d spans indices (L-1)*100 .. L*100. Available for
 *    every 2018-2024 race the simulator can play.
 *  - the `laps` DuckDB table (2022-2024 only) — official lap times, gaps,
 *    positions, compound and tyre age. When present its values win; telemetry
 *    fills in whatever it can't provide (approx sectors, speeds, corner pace).
 */

const SAMPLES_PER_LAP = 100;

/** Number of laps driver d fully completed (has a closing boundary sample). */
function completedLaps(d) {
  return Math.floor((d.n - 1) / SAMPLES_PER_LAP);
}

/**
 * Per-lap stats derivable from telemetry alone.
 * Sector times are track thirds (samples +33/+66/+100), NOT official sectors.
 * Returns Map<code, [{lap, lapTime, sector1, sector2, sector3, avgSpeed, maxSpeed}]>
 */
export function deriveLapStats(race) {
  const out = new Map();
  for (const d of race.drivers) {
    const recs = [];
    const nLaps = completedLaps(d);
    for (let L = 1; L <= nLaps; L++) {
      const base = (L - 1) * SAMPLES_PER_LAP;
      const t0 = d.t[base];
      const tA = d.t[base + 33];
      const tB = d.t[base + 66];
      const t1 = d.t[base + SAMPLES_PER_LAP];
      let sum = 0;
      let max = 0;
      for (let i = base; i < base + SAMPLES_PER_LAP; i++) {
        const v = d.speed[i];
        sum += v;
        if (v > max) max = v;
      }
      recs.push({
        lap: L,
        lapTime: t1 - t0,
        sector1: tA - t0,
        sector2: tB - tA,
        sector3: t1 - tB,
        avgSpeed: sum / SAMPLES_PER_LAP,
        maxSpeed: max,
      });
    }
    out.set(d.code, recs);
  }
  return out;
}

/**
 * Positions and gap-to-leader at each lap boundary, from lap-line crossing
 * times: driver d finishes lap L at d.t[L*100]. Gap = crossing − fastest
 * crossing that lap; position = rank of crossing times.
 * Returns Map<code, [{lap, position, gapToLeader}]>
 */
export function deriveGapsAndPositions(race) {
  const out = new Map(race.drivers.map((d) => [d.code, []]));
  const maxLaps = Math.max(...race.drivers.map(completedLaps), 0);
  for (let L = 1; L <= maxLaps; L++) {
    const crossings = [];
    for (const d of race.drivers) {
      if (completedLaps(d) >= L) {
        crossings.push({ code: d.code, t: d.t[L * SAMPLES_PER_LAP] });
      }
    }
    crossings.sort((a, b) => a.t - b.t);
    const leaderT = crossings.length ? crossings[0].t : 0;
    crossings.forEach((c, i) => {
      out.get(c.code).push({ lap: L, position: i + 1, gapToLeader: c.t - leaderT });
    });
  }
  return out;
}

// Corner classes (per-sample): index into CORNER_CLASSES.
export const CORNER_CLASSES = ["straight", "fast", "medium", "slow"];

/**
 * Classify each of the 100 per-lap sample positions once per race, from the
 * speed profile of the fastest telemetry lap: smooth, find local minima,
 * class by minimum speed (<120 slow, <190 medium, <250 fast km/h), expand
 * ±3 samples around each minimum; everything else is straight.
 * Returns Int8Array(100): 0 straight, 1 fast, 2 medium, 3 slow.
 */
export function classifyCorners(race) {
  // Reference lap = globally fastest complete lap
  let best = null;
  for (const d of race.drivers) {
    const nLaps = completedLaps(d);
    for (let L = 1; L <= nLaps; L++) {
      const base = (L - 1) * SAMPLES_PER_LAP;
      const lt = d.t[base + SAMPLES_PER_LAP] - d.t[base];
      if (lt > 0 && (!best || lt < best.lapTime)) best = { d, base, lapTime: lt };
    }
  }
  const classes = new Int8Array(SAMPLES_PER_LAP);
  if (!best) return classes;

  // 3-tap smoothed speed profile (circular — the lap wraps)
  const sp = new Float32Array(SAMPLES_PER_LAP);
  for (let i = 0; i < SAMPLES_PER_LAP; i++) {
    const a = best.d.speed[best.base + ((i + SAMPLES_PER_LAP - 1) % SAMPLES_PER_LAP)];
    const b = best.d.speed[best.base + i];
    const c = best.d.speed[best.base + ((i + 1) % SAMPLES_PER_LAP)];
    sp[i] = (a + b + c) / 3;
  }

  for (let i = 0; i < SAMPLES_PER_LAP; i++) {
    const prev = sp[(i + SAMPLES_PER_LAP - 1) % SAMPLES_PER_LAP];
    const next = sp[(i + 1) % SAMPLES_PER_LAP];
    if (sp[i] > prev || sp[i] > next) continue; // not a local minimum
    const v = sp[i];
    let cls;
    if (v < 120) cls = 3;
    else if (v < 190) cls = 2;
    else if (v < 250) cls = 1;
    else continue; // flat-out kink — leave as straight
    for (let k = -3; k <= 3; k++) {
      const j = (i + k + SAMPLES_PER_LAP) % SAMPLES_PER_LAP;
      if (cls > classes[j]) classes[j] = cls; // slower class wins on overlap
    }
  }
  return classes;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Median speed per corner class, per driver per lap.
 * Returns Map<code, [{lap, slowSpeed, medSpeed, fastSpeed, straightSpeed}]>
 */
export function deriveCornerSpeeds(race, cornerClasses) {
  const out = new Map();
  for (const d of race.drivers) {
    const recs = [];
    const nLaps = completedLaps(d);
    for (let L = 1; L <= nLaps; L++) {
      const base = (L - 1) * SAMPLES_PER_LAP;
      const buckets = [[], [], [], []];
      for (let i = 0; i < SAMPLES_PER_LAP; i++) {
        buckets[cornerClasses[i]].push(d.speed[base + i]);
      }
      recs.push({
        lap: L,
        straightSpeed: median(buckets[0]),
        fastSpeed: median(buckets[1]),
        medSpeed: median(buckets[2]),
        slowSpeed: median(buckets[3]),
      });
    }
    out.set(d.code, recs);
  }
  return out;
}

/**
 * Merge telemetry-derived stats with `laps` table rows (may be []).
 * Table values win for lapTime/position/gap/compound/tireAge/isPitLap;
 * telemetry always supplies sectors, speeds and corner pace.
 *
 * Returns {
 *   byDriver: Map<code, MergedLapRec[]>,  // MergedLapRec: { lap, lapTime,
 *     position, gapToLeader, compound, tireAge, isPitLap, outlier,
 *     sector1..3, avgSpeed, maxSpeed, slowSpeed, medSpeed, fastSpeed, straightSpeed }
 *   hasLapsTable: boolean,
 *   teams: Map<code, team>,
 * }
 */
export function buildComparisonDataset(race, lapsRows) {
  const lapStats = deriveLapStats(race);
  const gapsPos = deriveGapsAndPositions(race);
  const cornerSpeeds = deriveCornerSpeeds(race, classifyCorners(race));

  const tableByDriver = new Map();
  for (const r of lapsRows || []) {
    if (!tableByDriver.has(r.driver)) tableByDriver.set(r.driver, new Map());
    tableByDriver.get(r.driver).set(Number(r.lap_number), r);
  }
  const hasLapsTable = tableByDriver.size > 0;

  const byDriver = new Map();
  const teams = new Map();
  for (const d of race.drivers) {
    teams.set(d.code, d.team);
    const stats = lapStats.get(d.code) || [];
    const gp = gapsPos.get(d.code) || [];
    const cs = cornerSpeeds.get(d.code) || [];
    const table = tableByDriver.get(d.code);

    const recs = stats.map((s, i) => {
      const row = table?.get(s.lap);
      return {
        lap: s.lap,
        lapTime: row?.lap_time_seconds != null ? Number(row.lap_time_seconds) : s.lapTime,
        position: row?.position != null ? Number(row.position) : gp[i]?.position ?? null,
        gapToLeader:
          row?.gap_to_leader_seconds != null
            ? Number(row.gap_to_leader_seconds)
            : gp[i]?.gapToLeader ?? null,
        compound: row?.compound ?? null,
        tireAge: row?.tire_age_laps != null ? Number(row.tire_age_laps) : null,
        isPitLap: row ? Boolean(row.is_pit_lap) : false,
        outlier: false, // filled below
        sector1: s.sector1,
        sector2: s.sector2,
        sector3: s.sector3,
        avgSpeed: s.avgSpeed,
        maxSpeed: s.maxSpeed,
        slowSpeed: cs[i]?.slowSpeed ?? null,
        medSpeed: cs[i]?.medSpeed ?? null,
        fastSpeed: cs[i]?.fastSpeed ?? null,
        straightSpeed: cs[i]?.straightSpeed ?? null,
      };
    });

    // Outliers (pit in/out, SC crawling): laps well over the driver's median.
    // With table data pit laps are already flagged; the heuristic still marks
    // safety-car laps so pace lines stay readable.
    const med = median(recs.map((r) => r.lapTime).filter((v) => v > 0));
    if (med) {
      for (const r of recs) {
        if (r.isPitLap || r.lapTime > med * 1.15) r.outlier = true;
      }
    }
    byDriver.set(d.code, recs);
  }

  return { byDriver, hasLapsTable, teams };
}

/** Records for the given drivers, up to and including `lap`. */
export function sliceUpToLap(byDriver, codes, lap) {
  const out = new Map();
  for (const code of codes) {
    const recs = byDriver.get(code) || [];
    // recs are ordered by lap starting at 1, so slice is enough
    out.set(code, lap >= recs.length ? recs : recs.slice(0, Math.max(0, lap)));
  }
  return out;
}

/** Metric registry for the scatter axis pickers. */
export const METRICS = [
  { key: "lap", label: "Lap number", unit: "", needsLapsTable: false },
  { key: "lapTime", label: "Lap time", unit: "s", needsLapsTable: false },
  { key: "position", label: "Position", unit: "", needsLapsTable: false },
  { key: "gapToLeader", label: "Gap to leader", unit: "s", needsLapsTable: false },
  { key: "tireAge", label: "Tyre age", unit: "laps", needsLapsTable: true },
  { key: "avgSpeed", label: "Avg lap speed", unit: "km/h", needsLapsTable: false },
  { key: "maxSpeed", label: "Top speed", unit: "km/h", needsLapsTable: false },
  { key: "slowSpeed", label: "Slow-corner speed", unit: "km/h", needsLapsTable: false },
  { key: "medSpeed", label: "Med-corner speed", unit: "km/h", needsLapsTable: false },
  { key: "fastSpeed", label: "Fast-corner speed", unit: "km/h", needsLapsTable: false },
  { key: "straightSpeed", label: "Straight-line speed", unit: "km/h", needsLapsTable: false },
];

export function metricByKey(key) {
  return METRICS.find((m) => m.key === key);
}

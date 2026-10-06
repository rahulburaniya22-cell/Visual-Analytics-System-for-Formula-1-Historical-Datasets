/**
 * Pure math for the race simulator. No React, no canvas — just interpolation
 * over the per-driver telemetry arrays produced by getRaceTelemetry().
 *
 * Each driver has exactly 100 samples per lap, so the fractional sample index
 * `p` directly encodes race progress: progress = p / 100 laps completed.
 */

/** Largest index i such that arr[i] <= val (clamped to [0, n-1]). */
function lowerBound(arr, n, val) {
  if (n <= 1 || val <= arr[0]) return 0;
  if (val >= arr[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= val) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Interpolate a driver's state at sim time `t` (seconds).
 */
export function interpAt(d, t) {
  const n = d.n;
  if (n === 0) return null;

  if (t <= d.t[0]) {
    return {
      x: d.x[0], y: d.y[0],
      throttle: d.throttle[0], brake: d.brake[0], speed: d.speed[0],
      p: 0, progress: 0, live: true,
    };
  }
  if (t >= d.t[n - 1]) {
    return {
      x: d.x[n - 1], y: d.y[n - 1],
      throttle: d.throttle[n - 1], brake: d.brake[n - 1], speed: d.speed[n - 1],
      p: n - 1, progress: (n - 1) / 100, live: false,
    };
  }

  const i = lowerBound(d.t, n, t);
  const t0 = d.t[i];
  const t1 = d.t[i + 1];
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;

  return {
    x: d.x[i] + (d.x[i + 1] - d.x[i]) * f,
    y: d.y[i] + (d.y[i + 1] - d.y[i]) * f,
    throttle: d.throttle[i] + (d.throttle[i + 1] - d.throttle[i]) * f,
    brake: d.brake[i],
    speed: d.speed[i] + (d.speed[i + 1] - d.speed[i]) * f,
    p: i + f,
    progress: (i + f) / 100,
    live: true,
  };
}

/** Just the two telemetry channels the chart needs, sampled at time t. */
export function channelsAt(d, t) {
  const n = d.n;
  if (n === 0 || t < d.t[0] || t > d.t[n - 1]) return null;
  const i = lowerBound(d.t, n, t);
  if (i >= n - 1) {
    return { throttle: d.throttle[n - 1], brake: d.brake[n - 1] };
  }
  const t0 = d.t[i];
  const t1 = d.t[i + 1];
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  return {
    throttle: d.throttle[i] + (d.throttle[i + 1] - d.throttle[i]) * f,
    brake: d.brake[i],
  };
}

/**
 * Live standings at sim time `t`: drivers ranked by race progress (descending).
 */
export function standingsAt(drivers, t) {
  const out = [];
  for (const d of drivers) {
    const s = interpAt(d, t);
    if (!s) continue;
    out.push({
      code: d.code,
      team: d.team,
      progress: s.progress,
      lap: Math.floor(s.progress) + 1,
      live: s.live,
    });
  }
  out.sort((a, b) => b.progress - a.progress);
  return out;
}

/** Sim time at which the leader begins lap L (1-based). */
export function timeForLap(race, L) {
  const lap = Math.max(1, Math.min(race.nLaps, L));
  return race.lapStartT[lap] || 0;
}

/** Current 1-based lap of the overall leader at sim time `t`. */
export function leaderLapAt(race, t) {
  let lap = 1;
  for (let L = 1; L <= race.nLaps; L++) {
    if (t >= race.lapStartT[L]) lap = L;
    else break;
  }
  return lap;
}

function rotatePoint(x, y, cos, sin) {
  return [x * cos - y * sin, x * sin + y * cos];
}

/**
 * Build a projector mapping raw track coords -> canvas pixels.
 */
export function makeProjector(sources, width, height, pad = 28, rotationDeg = 0) {
  const a = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of sources) {
    if (!s) continue;
    const len = s.n != null ? s.n : s.x.length;
    for (let i = 0; i < len; i++) {
      const [rx, ry] = rotatePoint(s.x[i], s.y[i], cos, sin);
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }

  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const scale = Math.min((width - 2 * pad) / bw, (height - 2 * pad) / bh);
  const offX = (width - bw * scale) / 2;
  const offY = (height - bh * scale) / 2;

  return {
    project(x, y) {
      const [rx, ry] = rotatePoint(x, y, cos, sin);
      return [offX + (rx - minX) * scale, height - (offY + (ry - minY) * scale)];
    },
  };
}

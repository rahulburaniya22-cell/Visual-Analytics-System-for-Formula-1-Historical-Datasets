import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import duckdb_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";

const PARQUET_FILES = ["standings", "results", "laps", "stints"];
const PARQUET_BASE =
  "https://huggingface.co/datasets/Aman2406/f1-visual-analytics/resolve/main/data";

let dbInstance = null;
let connInstance = null;
let initPromise = null;

async function initDB() {
  const worker = new Worker(duckdb_worker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(duckdb_wasm);

  // Fetch parquet files from HF and register in DuckDB's virtual filesystem
  for (const name of PARQUET_FILES) {
    const resp = await fetch(`${PARQUET_BASE}/${name}.parquet`);
    const buf = new Uint8Array(await resp.arrayBuffer());
    await db.registerFileBuffer(`${name}.parquet`, buf);
  }

  const conn = await db.connect();

  // Create SQL views over registered files
  for (const name of PARQUET_FILES) {
    await conn.query(
      `CREATE VIEW ${name} AS SELECT * FROM read_parquet('${name}.parquet')`
    );
  }

  dbInstance = db;
  connInstance = conn;
  return conn;
}

/**
 * Returns a singleton DuckDB connection.
 * Safe to call multiple times — only initializes once.
 */
export async function getConnection() {
  if (connInstance) return connInstance;
  if (!initPromise) {
    initPromise = initDB();
  }
  return initPromise;
}

/**
 * Execute a SQL query and return results as a plain JS array of objects.
 */
export async function query(sql) {
  const conn = await getConnection();
  const result = await conn.query(sql);
  return result.toArray().map((row) => ({ ...row }));
}

/**
 * Execute a SQL query and return the raw Apache Arrow table.
 * Use this when you want columnar typed-array access (fast, no per-row object
 * allocation) — e.g. loading tens of thousands of telemetry samples.
 */
export async function queryArrow(sql) {
  const conn = await getConnection();
  return conn.query(sql);
}

const registeredFiles = new Set();

/**
 * Fetch a whole parquet file from the first URL that responds OK and register
 * it in DuckDB's virtual filesystem. Returns true on success.
 */
export async function registerParquet(virtualName, urls) {
  if (registeredFiles.has(virtualName)) return true;
  await getConnection();
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      // Reject HTML responses — SPA rewrites return 200 + text/html for missing files
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("text/html")) continue;
      const buf = new Uint8Array(await resp.arrayBuffer());
      await dbInstance.registerFileBuffer(virtualName, buf);
      registeredFiles.add(virtualName);
      return true;
    } catch {
      // try next url
    }
  }
  return false;
}

/**
 * Register a parquet file for HTTP range-request access instead of downloading
 * it whole. Use for large files where a query only needs a slice.
 */
export async function registerHttpParquet(virtualName, url) {
  if (registeredFiles.has(virtualName)) return true;
  await getConnection();
  try {
    await dbInstance.registerFileURL(
      virtualName,
      url,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    );
    registeredFiles.add(virtualName);
    return true;
  } catch {
    return false;
  }
}

/** Undo a register call so a different URL can be tried. */
export async function unregisterFile(virtualName) {
  registeredFiles.delete(virtualName);
  try {
    await dbInstance.dropFile(virtualName);
  } catch {
    // wasn't registered
  }
}

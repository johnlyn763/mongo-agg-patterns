"use strict";

/**
 * Run a pattern pipeline and print documents (not a test).
 *
 * Usage:
 *   node run-pattern.cjs 3 --table --limit 10
 *   node run-pattern.cjs 2 --table --limit 2
 *
 * Nested array-of-object fields (e.g. topProducts) print as sub-tables.
 *
 * Env:
 *   MONGODB_URI  default mongodb://127.0.0.1:27017
 */

const path = require("path");
const { withClient } = require("./helpers/mongo");

const RUNNER_VERSION = "2026-09-17-nested-tables";

function usage() {
  console.error(`Usage: node run-pattern.cjs <1-10> [--limit N] [--table]

Examples:
  node run-pattern.cjs 3 --table --limit 10
  node run-pattern.cjs 2 --table --limit 2
  npm run demo -- 7 --table`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") usage();

  const n = Number(args[0]);
  if (!Number.isInteger(n) || n < 1 || n > 10) usage();

  let limit = null;
  let table = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--limit") {
      limit = Number(args[++i]);
      if (!Number.isInteger(limit) || limit < 0) {
        console.error("--limit must be a non-negative integer");
        process.exit(1);
      }
    } else if (args[i] === "--table" || args[i] === "-t") {
      table = true;
    } else {
      console.error("Unknown argument:", args[i]);
      usage();
    }
  }
  return { n, limit, table };
}

function loadPattern(n) {
  const id = String(n).padStart(2, "0");
  const mod = require(path.join(__dirname, "patterns", `pattern-${id}.js`));
  if (typeof mod.getPipeline !== "function") {
    throw new Error(`pattern-${id}.js does not export getPipeline`);
  }
  return mod;
}

function isDate(value) {
  return value instanceof Date;
}

function isBsonLeaf(value) {
  return Boolean(value && typeof value === "object" && value._bsontype);
}

/** Object that can be a nested table row (including docs with Decimal128 fields). */
function isRowObject(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isDate(value) &&
    !isBsonLeaf(value)
  );
}

function isArrayOfRowObjects(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isRowObject);
}

function cellValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (isDate(value)) return value.toISOString();
  if (typeof value === "object") {
    if (value._bsontype === "Decimal128") return value.toString();
    if (value._bsontype === "ObjectId") return value.toString();
    if (typeof value.toJSON === "function" && value._bsontype) {
      const j = value.toJSON();
      if (j && typeof j === "object" && "$numberDecimal" in j) return j.$numberDecimal;
      return String(j);
    }
    return JSON.stringify(value, jsonReplacer);
  }
  return String(value);
}

function jsonReplacer(_key, value) {
  if (value && typeof value === "object") {
    if (typeof value.toJSON === "function" && value._bsontype) {
      return value.toJSON();
    }
    if (value._bsontype === "Decimal128") return value.toString();
    if (value._bsontype === "ObjectId") return value.toString();
  }
  return value;
}

function splitRow(row) {
  const scalars = {};
  const nestedArrays = {};
  const nestedObjects = {};
  const other = {};

  for (const [key, value] of Object.entries(row)) {
    if (isArrayOfRowObjects(value)) nestedArrays[key] = value;
    else if (Array.isArray(value) && value.length === 0) scalars[key] = "(empty)";
    else if (isRowObject(value)) nestedObjects[key] = value;
    else if (
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      isDate(value) ||
      isBsonLeaf(value)
    ) {
      scalars[key] = value;
    } else {
      other[key] = value;
    }
  }
  return { scalars, nestedArrays, nestedObjects, other };
}

function printTable(rows, indent = "") {
  if (!rows || rows.length === 0) {
    console.log(`${indent}(no rows)`);
    return;
  }

  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const matrix = rows.map((row) => columns.map((col) => cellValue(row[col])));
  const widths = columns.map((col, i) =>
    Math.max(col.length, ...matrix.map((r) => Math.min(r[i].length, 60)))
  );

  // Cap very wide cells for display
  const clip = (s, w) => (s.length <= w ? s : s.slice(0, Math.max(0, w - 1)) + "…");

  const sep = indent + "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const fmt = (cells) =>
    indent +
    "| " +
    cells.map((c, i) => clip(c, widths[i]).padEnd(widths[i])).join(" | ") +
    " |";

  console.log(sep);
  console.log(fmt(columns));
  console.log(sep);
  for (const row of matrix) console.log(fmt(row));
  console.log(sep);
}

function printExpandedRows(rows) {
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }

  rows.forEach((row, index) => {
    const { scalars, nestedArrays, nestedObjects, other } = splitRow(row);

    console.log(`\n=== row ${index + 1} of ${rows.length} ===`);

    const scalarKeys = Object.keys(scalars);
    if (scalarKeys.length > 0) {
      const one = {};
      for (const k of scalarKeys) one[k] = scalars[k];
      printTable([one]);
    }

    for (const [key, obj] of Object.entries(nestedObjects)) {
      console.log(`\n${key}:`);
      printTable([obj], "  ");
    }

    for (const [key, arr] of Object.entries(nestedArrays)) {
      console.log(`\n${key}:  (${arr.length} nested row${arr.length === 1 ? "" : "s"})`);
      printTable(arr, "  ");
    }

    for (const [key, value] of Object.entries(other)) {
      console.log(`\n${key}:`);
      console.log("  " + cellValue(value));
    }

    if (
      scalarKeys.length === 0 &&
      Object.keys(nestedArrays).length === 0 &&
      Object.keys(nestedObjects).length === 0 &&
      Object.keys(other).length === 0
    ) {
      console.log("(empty row)");
    }
  });
  console.log("");
}

async function main() {
  const { n, limit, table } = parseArgs(process.argv);
  const mod = loadPattern(n);
  const pipeline = mod.getPipeline();
  const dbName = mod.DEFAULT_DB || "sample_supplies";
  const collName = mod.DEFAULT_COLL || "sales";

  await withClient(async (client) => {
    const coll = client.db(dbName).collection(collName);
    let cursor = coll.aggregate(pipeline);
    if (limit != null) cursor = cursor.limit(limit);
    const rows = await cursor.toArray();

    console.error(
      `# run-pattern ${RUNNER_VERSION}` +
        `\n# Pattern ${n}  db=${dbName}  collection=${collName}  rows=${rows.length}` +
        (limit != null ? `  (limit ${limit})` : "") +
        (table ? "  format=table-nested" : "  format=json")
    );

    if (table) printExpandedRows(rows);
    else console.log(JSON.stringify(rows, jsonReplacer, 2));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

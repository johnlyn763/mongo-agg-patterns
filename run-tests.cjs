"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const patternsDir = path.join(__dirname, "patterns");
const files = fs
  .readdirSync(patternsDir)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => path.join(patternsDir, name));

if (files.length === 0) {
  console.error("No *.test.js files found in patterns/");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  { stdio: "inherit" }
);

process.exit(result.status === null ? 1 : result.status);

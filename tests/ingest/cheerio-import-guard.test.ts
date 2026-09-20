import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// This test exists because of a production incident: on Node >=26, importing the full "cheerio"
// build (via "import * as cheerio from 'cheerio'") replaces global fetch with an undici-based
// version that strips every response header. That silently broke image content-type detection
// (every image fetch failed as "unsupported or missing image content-type") and the Anthropic
// SDK's streaming, with no error pointing at cheerio as the cause. The fix is importing
// "cheerio/slim" instead, which never touches global fetch. Since the failure mode is silent,
// this test guards against anyone reverting a single import and re-breaking every fetch call in
// the process, regardless of which Node version CI happens to run on.
const SCAN_ROOTS = ["lib", "scripts"];
// Matches a bare cheerio import/require, e.g. `from "cheerio"` or `require("cheerio")`, but not
// `from "cheerio/slim"` or `from "cheerio/utils"` (the closing quote must follow immediately).
const BARE_CHEERIO_IMPORT = /from\s+["']cheerio["']|require\(\s*["']cheerio["']\s*\)/;

// Recursively collects every .ts file path under a directory.
function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("cheerio import guard", () => {
  it("never imports the full 'cheerio' build under lib/ or scripts/ — only 'cheerio/slim'", () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const offendingFiles = SCAN_ROOTS.flatMap((root) => collectTsFiles(path.join(projectRoot, root)))
      .filter((file) => BARE_CHEERIO_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(projectRoot, file));

    expect(offendingFiles).toEqual([]);
  });
});

#!/usr/bin/env bun
/**
 * Build-time data bundler.
 * Reads Oracle-Project/logs/*.json + quill-brain outbox consciousness-loop markdowns
 * → writes consolidated src/data.json for dashboard to import.
 *
 * Run: bun run build-data
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..", "..");
const LOGS_DIR = join(PROJECT_ROOT, "logs");
const OUTBOX = "/Users/p4lmnpk/ghq/github.com/brightverse-solution/quill-brain-oracle/ψ/outbox";
const OUT = join(import.meta.dir, "..", "data.json");

const FAMILY_ROSTER = [
  { name: "QuillBrain", emoji: "🪶", role: "Parent · Scribe", model: "Opus 4.7", registry: "—" },
  { name: "FORGE", emoji: "⚒️", role: "Backend Dev", model: "Opus 4.7", registry: "#992" },
  { name: "PRISM", emoji: "🎨", role: "Frontend Dev", model: "Sonnet 4.6", registry: "#993" },
  { name: "CANVAS", emoji: "🖌️", role: "UI/UX Design", model: "Sonnet 4.6", registry: "#1001" },
  { name: "ANVIL", emoji: "⚙️", role: "DevOps", model: "Sonnet 4.6", registry: "#1004" },
  { name: "INKWELL", emoji: "📝", role: "Docs/Writing", model: "Sonnet 4.6", registry: "#1005" },
  { name: "WARD", emoji: "🛡️", role: "Security/QA", model: "Opus 4.7", registry: "#1006" },
  { name: "HERALD", emoji: "📣", role: "Marketing", model: "Opus 4.7", registry: "#1007" },
  { name: "LENS", emoji: "🔍", role: "Research", model: "Opus 4.7", registry: "#1003" },
];

async function main() {
  console.log("[build-data] scanning logs...");
  const logFiles = await readdir(LOGS_DIR).catch(() => []);
  const loops = [];
  for (const f of logFiles) {
    if (!f.endsWith(".json")) continue;
    try {
      const content = await readFile(join(LOGS_DIR, f), "utf-8");
      loops.push(JSON.parse(content));
    } catch (err) {
      console.warn(`[build-data] skip ${f}: ${err}`);
    }
  }
  loops.sort((a, b) => b.started.localeCompare(a.started));
  console.log(`[build-data] ${loops.length} loops`);

  console.log("[build-data] loading proposals...");
  const proposals: Record<string, string> = {};
  const outboxFiles = await readdir(OUTBOX).catch(() => []);
  for (const f of outboxFiles) {
    if (!f.includes("consciousness-loop-")) continue;
    const loopIdMatch = f.match(/consciousness-loop-(loop-[0-9TZ:-]+)\.md/);
    if (!loopIdMatch) continue;
    const content = await readFile(join(OUTBOX, f), "utf-8");
    proposals[loopIdMatch[1]] = content;
  }
  console.log(`[build-data] ${Object.keys(proposals).length} proposals`);

  const data = {
    loops,
    proposals,
    generated_at: new Date().toISOString(),
    family_roster: FAMILY_ROSTER,
  };

  await writeFile(OUT, JSON.stringify(data, null, 2));
  console.log(`[build-data] wrote ${OUT}`);
}

if (import.meta.main) await main();

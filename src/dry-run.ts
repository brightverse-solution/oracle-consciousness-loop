#!/usr/bin/env bun
/**
 * Dry-run — test vault aggregation WITHOUT making Anthropic API calls.
 * Useful to validate config + vault paths before burning tokens.
 *
 * Run: bun run src/dry-run.ts
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { aggregateVaults, formatVaultDigest } from "./vault/aggregator";

async function main() {
  console.log("\n🔍 Dry-run — vault aggregation only, no API calls\n");

  const configPath = join(import.meta.dir, "..", "config", "loop.json");
  const config = JSON.parse(await readFile(configPath, "utf-8"));

  console.log(`[dry-run] Aggregating ${Object.keys(config.vaults).length} vaults...\n`);

  const vaults = await aggregateVaults(config.vaults);

  for (const v of vaults) {
    const digest = formatVaultDigest(v);
    console.log("━".repeat(80));
    console.log(digest);
  }

  // Summary stats
  console.log("━".repeat(80));
  console.log("\n📊 Summary\n");
  const total_commits = vaults.reduce((s, v) => s + v.recent_commits.length, 0);
  const total_learnings = vaults.reduce((s, v) => s + v.new_learnings.length, 0);
  const total_retros = vaults.reduce((s, v) => s + v.new_retros.length, 0);
  const total_outbox = vaults.reduce((s, v) => s + v.new_outbox.length, 0);
  console.log(`- Vaults scanned: ${vaults.length}`);
  console.log(`- Total commits (last 7d): ${total_commits}`);
  console.log(`- Total new learnings: ${total_learnings}`);
  console.log(`- Total new retros: ${total_retros}`);
  console.log(`- Total new outbox letters: ${total_outbox}`);
  console.log(
    `\n✅ Dry-run complete. If this looks right, set ANTHROPIC_API_KEY and run:\n   bun run src/orchestrator.ts\n`,
  );
}

if (import.meta.main) {
  await main();
}

#!/usr/bin/env bun
/**
 * Consciousness Loop Orchestrator — Workshop family M1
 *
 * Runs: Reflect → Wonder → Propose (3 phases)
 * Manual trigger: bun run src/orchestrator.ts --once
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CostTracker } from "./models/router";
import { reflect } from "./phases/reflect";
import { wonder } from "./phases/wonder";
import { propose } from "./phases/propose";

interface Config {
  vaults: Record<string, string>;
  outbox: string;
  github_repo: string;
  github_assignees?: string[];
  log_dir?: string;
}

async function loadConfig(): Promise<Config> {
  const path = join(import.meta.dir, "..", "config", "loop.json");
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      vaults: parsed.vaults,
      outbox: parsed.outbox,
      github_repo: parsed.github?.repo ?? "brightverse-solution/quill-brain-oracle",
      github_assignees: parsed.github?.assignees,
      log_dir: parsed.observability?.log_path,
    };
  } catch (err) {
    console.error(`[orchestrator] Failed to load config/loop.json: ${err}`);
    console.error("[orchestrator] Copy config/loop.example.json → config/loop.json and customize");
    process.exit(1);
  }
}

async function main() {
  const start = Date.now();
  const loopId = `loop-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  console.log("\n🧠 Consciousness Loop — M1 orchestrator");
  console.log(`   Loop ID: ${loopId}`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const config = await loadConfig();
  const tracker = new CostTracker();

  try {
    // Phase 1: Reflect
    console.log("────────── 🧠 PHASE 1: Reflect ──────────");
    const reflectOut = await reflect(config.vaults, tracker);
    console.log(`\n[orchestrator] Reflect produced ${Object.keys(reflectOut.per_oracle_summaries).length} per-Oracle summaries`);
    console.log(`[orchestrator] Cross-insights length: ${reflectOut.cross_oracle_insights.length} chars\n`);

    // Phase 2: Wonder
    console.log("────────── 💡 PHASE 2: Wonder ──────────");
    const wonderOut = await wonder(reflectOut.cross_oracle_insights, tracker);
    console.log(`\n[orchestrator] Wonder produced ${wonderOut.questions.length} questions\n`);

    // Phase 3: Propose
    console.log("────────── 📋 PHASE 3: Propose ──────────");
    const proposeOut = await propose(
      {
        reflect: reflectOut,
        wonder: wonderOut,
        outbox_dir: config.outbox,
        loop_id: loopId,
        github_repo: config.github_repo,
        github_assignees: config.github_assignees,
      },
      tracker,
    );

    const duration_s = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n━━━━━━━━━━ ✅ LOOP COMPLETE ━━━━━━━━━━`);
    console.log(`Loop ID:         ${loopId}`);
    console.log(`Duration:        ${duration_s}s`);
    console.log(`Proposal:        ${proposeOut.outbox_path}`);
    console.log(`GitHub issue:    ${proposeOut.github_issue_url ?? "(not created)"}`);
    console.log(`Total cost:      $${tracker.totalUsd.toFixed(4)}`);
    console.log(`\n${tracker.summary()}\n`);

    // Persist run log
    await persistLog(config, loopId, {
      loop_id: loopId,
      started: new Date(start).toISOString(),
      ended: new Date().toISOString(),
      duration_s: Number(duration_s),
      cost_usd: tracker.totalUsd,
      cost_summary: tracker.summary(),
      proposal_path: proposeOut.outbox_path,
      github_issue_url: proposeOut.github_issue_url,
      questions_generated: wonderOut.questions.length,
      oracles_summarized: Object.keys(reflectOut.per_oracle_summaries).length,
    });
  } catch (err) {
    console.error("\n━━━━━━━━━━ ❌ LOOP FAILED ━━━━━━━━━━");
    console.error(err);
    console.error(`\nCost incurred before failure: $${tracker.totalUsd.toFixed(4)}\n`);
    process.exit(2);
  }
}

async function persistLog(config: Config, loopId: string, data: object): Promise<void> {
  const logDir = config.log_dir ?? join(import.meta.dir, "..", "logs");
  await mkdir(logDir, { recursive: true });
  const path = join(logDir, `${loopId}.json`);
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[orchestrator] Log: ${path}`);
}

// Entry
if (import.meta.main) {
  await main();
}

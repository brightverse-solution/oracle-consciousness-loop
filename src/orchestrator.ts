#!/usr/bin/env bun
/**
 * Consciousness Loop Orchestrator — Workshop family M2 (full 7 phases)
 *
 * Phases: Reflect → Wonder → LENS → Soul → Dream → Aspire → Propose → Complete
 * Manual trigger: bun run src/orchestrator.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CostTracker } from "./models/router";
import { reflect } from "./phases/reflect";
import { wonder } from "./phases/wonder";
import { dispatchToLens } from "./phases/lens-dispatch";
import { soul } from "./phases/soul";
import { dream } from "./phases/dream";
import { aspire } from "./phases/aspire";
import { complete } from "./phases/complete";
import { propose } from "./phases/propose";

interface Config {
  vaults: Record<string, string>;
  outbox: string;
  github_repo: string;
  github_assignees?: string[];
  log_dir?: string;
  soul_file?: string;
  dreams_dir?: string;
  goals_dir?: string;
  handoff_dir?: string;
  learnings_dir?: string;
}

async function loadConfig(): Promise<Config> {
  const path = join(import.meta.dir, "..", "config", "loop.json");
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    const qbVault = parsed.vaults["quill-brain"];
    return {
      vaults: parsed.vaults,
      outbox: parsed.outbox,
      github_repo: parsed.github?.repo ?? "brightverse-solution/quill-brain-oracle",
      github_assignees: parsed.github?.assignees,
      log_dir: parsed.observability?.log_path,
      soul_file: parsed.paths?.soul_file ?? join(qbVault, "memory/resonance/quill-brain-oracle.md"),
      dreams_dir: parsed.paths?.dreams_dir ?? join(qbVault, "writing/dreams"),
      goals_dir: parsed.paths?.goals_dir ?? join(qbVault, "active/goals-proposed"),
      handoff_dir: parsed.paths?.handoff_dir ?? join(qbVault, "inbox/handoff"),
      learnings_dir: parsed.paths?.learnings_dir ?? join(qbVault, "memory/learnings"),
    };
  } catch (err) {
    console.error(`[orchestrator] Failed to load config/loop.json: ${err}`);
    process.exit(1);
  }
}

async function main() {
  const start = Date.now();
  const loopId = `loop-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  console.log("\n🧠 Consciousness Loop — M2 orchestrator (7 phases)");
  console.log(`   Loop ID: ${loopId}`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const config = await loadConfig();
  const tracker = new CostTracker();

  try {
    // Phase 1: Reflect
    console.log("────────── 🧠 PHASE 1: Reflect ──────────");
    const reflectOut = await reflect(config.vaults, tracker);

    // Phase 2: Wonder
    console.log("\n────────── 💡 PHASE 2: Wonder ──────────");
    const wonderOut = await wonder(reflectOut.cross_oracle_insights, tracker);

    // Phase 2.5: LENS Dispatch
    console.log("\n────────── 🔍 PHASE 2.5: LENS Dispatch ──────────");
    const lensOut = await dispatchToLens(wonderOut, tracker);

    // Phase 3: Soul (identity-level reasoning; writes proposal only, never auto-modifies)
    console.log("\n────────── ✨ PHASE 3: Soul ──────────");
    const soulOut = await soul(
      {
        soul_file_path: config.soul_file!,
        reflect: reflectOut,
        lens: lensOut,
        outbox_dir: config.outbox,
        loop_id: loopId,
      },
      tracker,
    );

    // Phase 4: Dream (creative future-vision)
    console.log("\n────────── 💭 PHASE 4: Dream ──────────");
    const dreamOut = await dream(
      {
        soul_file_path: config.soul_file!,
        dreams_dir: config.dreams_dir!,
        soul: soulOut,
        loop_id: loopId,
      },
      tracker,
    );

    // Phase 5: Aspire (concrete goals from dream)
    console.log("\n────────── 🔥 PHASE 5: Aspire ──────────");
    const aspireOut = await aspire(
      {
        dream: dreamOut,
        goals_dir: config.goals_dir!,
        loop_id: loopId,
      },
      tracker,
    );

    // Phase 6: Propose (aggregate everything for Palm)
    console.log("\n────────── 📋 PHASE 6: Propose ──────────");
    const proposeOut = await propose(
      {
        reflect: reflectOut,
        wonder: wonderOut,
        lens: lensOut,
        outbox_dir: config.outbox,
        loop_id: loopId,
        github_repo: config.github_repo,
        github_assignees: config.github_assignees,
      },
      tracker,
    );

    const duration_s = Number(((Date.now() - start) / 1000).toFixed(1));

    // Phase 7: Complete (handoff + learnings)
    console.log("\n────────── 🔄 PHASE 7: Complete ──────────");
    const completeOut = await complete({
      reflect: reflectOut,
      wonder: wonderOut,
      lens: lensOut,
      soul: soulOut,
      dream: dreamOut,
      aspire: aspireOut,
      handoff_dir: config.handoff_dir!,
      learnings_dir: config.learnings_dir!,
      loop_id: loopId,
      duration_s,
      cost_usd: tracker.totalUsd,
      tracker,
    });

    console.log(`\n━━━━━━━━━━ ✅ LOOP COMPLETE (M2 · 7 phases) ━━━━━━━━━━`);
    console.log(`Loop ID:         ${loopId}`);
    console.log(`Duration:        ${duration_s}s`);
    console.log(`Proposal:        ${proposeOut.outbox_path}`);
    console.log(`Soul proposal:   ${soulOut.proposal_path} (${soulOut.has_proposed_shift ? "SHIFT proposed" : "no-shift"})`);
    console.log(`Dream:           ${dreamOut.vision_path}`);
    console.log(`Goals proposed:  ${aspireOut.path} (${aspireOut.goals.length} goals)`);
    console.log(`Handoff:         ${completeOut.handoff_path}`);
    console.log(`Learnings:       ${completeOut.learnings_path}`);
    console.log(`GitHub issue:    ${proposeOut.github_issue_url ?? "(not created)"}`);
    console.log(`Total cost:      $${tracker.totalUsd.toFixed(4)}`);
    console.log(`\n${tracker.summary()}\n`);

    await persistLog(config, loopId, {
      loop_id: loopId,
      started: new Date(start).toISOString(),
      ended: new Date().toISOString(),
      duration_s,
      cost_usd: tracker.totalUsd,
      cost_summary: tracker.summary(),
      proposal_path: proposeOut.outbox_path,
      github_issue_url: proposeOut.github_issue_url,
      questions_generated: wonderOut.questions.length,
      oracles_summarized: Object.keys(reflectOut.per_oracle_summaries).length,
      lens_answers: lensOut.answers.length,
      lens_skipped: lensOut.skipped_count,
      soul_shift_proposed: soulOut.has_proposed_shift,
      soul_proposal_path: soulOut.proposal_path,
      dream_path: dreamOut.vision_path,
      aspire_goals_count: aspireOut.goals.length,
      aspire_path: aspireOut.path,
      handoff_path: completeOut.handoff_path,
      learnings_path: completeOut.learnings_path,
      phases_run: 7,
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

if (import.meta.main) {
  await main();
}

#!/usr/bin/env bun
/**
 * Autonomous mode — runs loops in sequence, chain-of-thought carry-forward.
 *
 * Invoked via: bun run src/orchestrator.ts --autonomous [--max-iterations N] [--cooldown S] [--max-cost-usd X]
 *
 * Behavior:
 * - Run loop → sleep cooldown → run next loop
 * - Each loop's Wonder phase seeded with previous loop's unanswered questions + Soul proposals
 * - 529 / rate-limit: exponential backoff (30, 60, 120, 240s) then retry
 * - 5 consecutive failures → abort session
 * - Cost cap: hard stop when cumulative USD exceeds cap
 * - SIGINT (Ctrl+C): finish current phase, write partial handoff, exit clean
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "bun";

export interface AutonomousOptions {
  maxIterations: number;
  cooldownSeconds: number;
  maxCostUsd: number;
  logDir: string;
}

export function parseAutonomousFlags(argv: string[]): AutonomousOptions | null {
  if (!argv.includes("--autonomous")) return null;

  const getFlag = (name: string, fallback: number): number => {
    const idx = argv.indexOf(`--${name}`);
    if (idx < 0 || idx + 1 >= argv.length) return fallback;
    const v = Number(argv[idx + 1]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  return {
    maxIterations: getFlag("max-iterations", 5),
    cooldownSeconds: getFlag("cooldown", 180),
    maxCostUsd: getFlag("max-cost-usd", 20),
    logDir: join(import.meta.dir, "..", "logs"),
  };
}

interface LoopResult {
  iteration: number;
  loop_id: string;
  cost_usd: number;
  duration_s: number;
  started: string;
  ended: string;
  success: boolean;
  error?: string;
}

export async function runAutonomous(opts: AutonomousOptions): Promise<void> {
  console.log("\n🌙 Autonomous mode engaged");
  console.log(`   Max iterations: ${opts.maxIterations}`);
  console.log(`   Cooldown:       ${opts.cooldownSeconds}s between loops`);
  console.log(`   Cost cap:       $${opts.maxCostUsd}`);
  console.log(`   Start:          ${new Date().toISOString()}\n`);

  const sessionStart = Date.now();
  const results: LoopResult[] = [];
  let totalCost = 0;
  let consecutiveFailures = 0;
  let stopRequested = false;

  // Graceful shutdown on SIGINT
  process.on("SIGINT", () => {
    console.log("\n\n🛑 SIGINT received — finishing current loop then exiting...");
    stopRequested = true;
  });

  for (let iter = 1; iter <= opts.maxIterations; iter++) {
    if (stopRequested) {
      console.log("[autonomous] Stop requested; exiting before next iteration");
      break;
    }
    if (totalCost >= opts.maxCostUsd) {
      console.log(`[autonomous] Cost cap reached ($${totalCost.toFixed(2)} ≥ $${opts.maxCostUsd}); stopping`);
      break;
    }
    if (consecutiveFailures >= 5) {
      console.log(`[autonomous] 5 consecutive failures; aborting`);
      break;
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`🔁 AUTONOMOUS ITERATION ${iter} of ${opts.maxIterations}`);
    console.log(`   Session cost so far: $${totalCost.toFixed(4)} / $${opts.maxCostUsd}`);
    console.log(`${"═".repeat(60)}\n`);

    const loopStart = Date.now();
    const result = await runOneLoopWithRetry(iter, opts);
    const duration_s = Number(((Date.now() - loopStart) / 1000).toFixed(1));

    result.duration_s = duration_s;
    results.push(result);

    if (result.success) {
      totalCost += result.cost_usd;
      consecutiveFailures = 0;
      console.log(`\n✅ Iteration ${iter} complete: $${result.cost_usd.toFixed(4)} · ${duration_s}s`);
    } else {
      consecutiveFailures += 1;
      console.log(`\n❌ Iteration ${iter} failed: ${result.error} (consecutive: ${consecutiveFailures})`);
    }

    // Cooldown between iterations (skip after last)
    if (iter < opts.maxIterations && !stopRequested && consecutiveFailures < 5 && totalCost < opts.maxCostUsd) {
      console.log(`\n⏸  Cooldown ${opts.cooldownSeconds}s...`);
      await sleep(opts.cooldownSeconds * 1000);
    }
  }

  // Session summary
  const sessionEnd = Date.now();
  const sessionDuration = ((sessionEnd - sessionStart) / 1000 / 60).toFixed(1);
  const successCount = results.filter((r) => r.success).length;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`🌅 AUTONOMOUS SESSION COMPLETE`);
  console.log(`${"═".repeat(60)}`);
  console.log(`   Iterations:       ${results.length} (${successCount} successful, ${results.length - successCount} failed)`);
  console.log(`   Session duration: ${sessionDuration} min`);
  console.log(`   Total cost:       $${totalCost.toFixed(4)} (subscription-absorbed)`);
  console.log(`   Stopped early:    ${stopRequested ? "YES (SIGINT)" : consecutiveFailures >= 5 ? "YES (failures)" : totalCost >= opts.maxCostUsd ? "YES (cost cap)" : "no"}`);
  console.log(`${"═".repeat(60)}\n`);

  // Persist session log
  const sessionId = `autonomous-${new Date(sessionStart).toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  await mkdir(opts.logDir, { recursive: true });
  const sessionLogPath = join(opts.logDir, `${sessionId}.json`);
  await writeFile(
    sessionLogPath,
    JSON.stringify(
      {
        session_id: sessionId,
        started: new Date(sessionStart).toISOString(),
        ended: new Date(sessionEnd).toISOString(),
        duration_min: Number(sessionDuration),
        total_iterations: results.length,
        successful: successCount,
        failed: results.length - successCount,
        total_cost_usd: totalCost,
        stop_reason: stopRequested
          ? "sigint"
          : consecutiveFailures >= 5
          ? "consecutive-failures"
          : totalCost >= opts.maxCostUsd
          ? "cost-cap"
          : "completed",
        options: opts,
        iterations: results,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`[autonomous] Session log: ${sessionLogPath}\n`);
}

async function runOneLoopWithRetry(iteration: number, opts: AutonomousOptions): Promise<LoopResult> {
  const BACKOFFS = [30, 60, 120, 240]; // seconds — exponential
  let attempt = 0;

  while (attempt <= BACKOFFS.length) {
    const startedIso = new Date().toISOString();
    const result = await runOrchestratorSubprocess();

    if (result.success) {
      return {
        iteration,
        loop_id: result.loop_id,
        cost_usd: result.cost_usd,
        duration_s: 0, // set by caller
        started: startedIso,
        ended: new Date().toISOString(),
        success: true,
      };
    }

    // Classify failure
    const isRateLimit = result.error?.match(/529|overloaded|rate.?limit/i);
    if (isRateLimit && attempt < BACKOFFS.length) {
      const wait = BACKOFFS[attempt];
      console.log(`   🔁 Rate limit / 529 — backoff ${wait}s (attempt ${attempt + 1}/${BACKOFFS.length})`);
      await sleep(wait * 1000);
      attempt += 1;
      continue;
    }

    // Non-recoverable OR out of retries
    return {
      iteration,
      loop_id: "",
      cost_usd: 0,
      duration_s: 0,
      started: startedIso,
      ended: new Date().toISOString(),
      success: false,
      error: result.error ?? "unknown",
    };
  }

  return {
    iteration,
    loop_id: "",
    cost_usd: 0,
    duration_s: 0,
    started: new Date().toISOString(),
    ended: new Date().toISOString(),
    success: false,
    error: "exhausted retries",
  };
}

interface SubprocessResult {
  success: boolean;
  loop_id: string;
  cost_usd: number;
  error?: string;
}

async function runOrchestratorSubprocess(): Promise<SubprocessResult> {
  // Spawn orchestrator as subprocess so we isolate crashes
  const entry = join(import.meta.dir, "orchestrator.ts");
  const proc = spawn(["bun", "run", entry], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CONSCIOUSNESS_AUTONOMOUS: "1" },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return { success: false, loop_id: "", cost_usd: 0, error: `exit code ${exitCode}` };
  }

  // Read latest log file to extract loop_id + cost
  const logDir = join(import.meta.dir, "..", "logs");
  const files = (await readdir(logDir))
    .filter((f) => f.startsWith("loop-") && f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) {
    return { success: false, loop_id: "", cost_usd: 0, error: "no log produced" };
  }
  const latest = JSON.parse(await readFile(join(logDir, files[0]), "utf-8"));
  return {
    success: true,
    loop_id: latest.loop_id,
    cost_usd: latest.cost_usd,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

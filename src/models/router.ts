/**
 * Model router — uses Claude Code CLI (`claude -p`) via subprocess.
 *
 * WHY NOT SDK: Palm has Claude Max subscription which covers unlimited CLI
 * usage via OAuth. Anthropic SDK would require a separate API key and
 * per-token billing. CLI route uses subscription auth — no extra cost.
 *
 * Cost tracking in CostTracker is informational only (Max subscription
 * absorbs actual billing). Useful for per-loop signal on prompt-cache
 * hit rates + phase cost breakdown.
 */

import { spawn } from "bun";

export type ModelTier = "haiku" | "sonnet" | "opus";

const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

export interface LLMCallResult {
  text: string;
  model: ModelTier;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number; // informational — Max subscription absorbs actual billing
  duration_ms: number;
}

export interface LLMCallOptions {
  tier: ModelTier;
  system?: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  /** Claude CLI tools to allow (e.g. "WebSearch", "WebFetch", "Bash"). Enables multi-turn agentic behavior. */
  allowed_tools?: string[];
  /** Max agentic turns (only applies when tools enabled). */
  max_turns?: number;
}

interface ClaudeCliJsonResult {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  duration_ms: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  total_cost_usd: number;
}

export async function llm(opts: LLMCallOptions): Promise<LLMCallResult> {
  const model = MODEL_IDS[opts.tier];
  const args = ["claude", "--model", model, "-p", "--output-format", "json"];

  if (opts.system) {
    args.push("--system-prompt", opts.system);
  }

  if (opts.allowed_tools && opts.allowed_tools.length > 0) {
    args.push("--allowedTools", opts.allowed_tools.join(" "));
  }

  if (opts.max_turns !== undefined) {
    args.push("--max-turns", String(opts.max_turns));
  }

  const proc = spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    cwd: "/tmp", // avoid picking up any local CLAUDE.md
  });

  // Write user prompt to stdin
  proc.stdin.write(opts.user);
  await proc.stdin.end();

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`claude CLI exited ${exitCode}: ${stderr.slice(0, 500)}`);
  }

  let parsed: ClaudeCliJsonResult;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Failed to parse claude CLI JSON output: ${err}. Raw: ${stdout.slice(0, 500)}`);
  }

  if (parsed.is_error) {
    throw new Error(`claude CLI reported error: ${parsed.subtype}`);
  }

  return {
    text: parsed.result,
    model: opts.tier,
    input_tokens: parsed.usage.input_tokens,
    output_tokens: parsed.usage.output_tokens,
    cache_read_tokens: parsed.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: parsed.usage.cache_creation_input_tokens ?? 0,
    cost_usd: parsed.total_cost_usd,
    duration_ms: parsed.duration_ms,
  };
}

export class CostTracker {
  private calls: LLMCallResult[] = [];

  record(result: LLMCallResult): void {
    this.calls.push(result);
  }

  get totalUsd(): number {
    return this.calls.reduce((s, c) => s + c.cost_usd, 0);
  }

  get totalCalls(): number {
    return this.calls.length;
  }

  get totalDurationMs(): number {
    return this.calls.reduce((s, c) => s + c.duration_ms, 0);
  }

  summary(): string {
    const byTier: Record<
      ModelTier,
      { count: number; cost: number; in: number; out: number; cache_r: number; cache_c: number }
    > = {
      haiku: { count: 0, cost: 0, in: 0, out: 0, cache_r: 0, cache_c: 0 },
      sonnet: { count: 0, cost: 0, in: 0, out: 0, cache_r: 0, cache_c: 0 },
      opus: { count: 0, cost: 0, in: 0, out: 0, cache_r: 0, cache_c: 0 },
    };
    for (const c of this.calls) {
      const b = byTier[c.model];
      b.count += 1;
      b.cost += c.cost_usd;
      b.in += c.input_tokens;
      b.out += c.output_tokens;
      b.cache_r += c.cache_read_tokens;
      b.cache_c += c.cache_creation_tokens;
    }
    const lines: string[] = [
      "## Cost breakdown",
      "",
      "*(billing absorbed by Claude Max subscription; figures informational)*",
      "",
    ];
    for (const [tier, b] of Object.entries(byTier)) {
      if (b.count === 0) continue;
      lines.push(
        `- **${tier}**: ${b.count} calls · in=${b.in.toLocaleString()} out=${b.out.toLocaleString()} · cache read=${b.cache_r.toLocaleString()} create=${b.cache_c.toLocaleString()} · $${b.cost.toFixed(4)}`,
      );
    }
    lines.push("", `**Total: $${this.totalUsd.toFixed(4)} (subscription-absorbed)**`);
    return lines.join("\n");
  }
}

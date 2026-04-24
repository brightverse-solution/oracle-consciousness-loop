import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type ModelTier = "haiku" | "sonnet" | "opus";

const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

// Rough per-M-token pricing (USD). Used for cost tracking only.
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 0.8, output: 4.0 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
};

export interface LLMCallResult {
  text: string;
  model: ModelTier;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

export interface LLMCallOptions {
  tier: ModelTier;
  system?: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
}

export async function llm(opts: LLMCallOptions): Promise<LLMCallResult> {
  const start = Date.now();
  const model = MODEL_IDS[opts.tier];

  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const input_tokens = response.usage.input_tokens;
  const output_tokens = response.usage.output_tokens;
  const price = PRICING[opts.tier];
  const cost_usd = (input_tokens / 1_000_000) * price.input + (output_tokens / 1_000_000) * price.output;

  return {
    text,
    model: opts.tier,
    input_tokens,
    output_tokens,
    cost_usd,
    duration_ms: Date.now() - start,
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

  summary(): string {
    const byTier: Record<ModelTier, { count: number; cost: number; in: number; out: number }> = {
      haiku: { count: 0, cost: 0, in: 0, out: 0 },
      sonnet: { count: 0, cost: 0, in: 0, out: 0 },
      opus: { count: 0, cost: 0, in: 0, out: 0 },
    };
    for (const c of this.calls) {
      const b = byTier[c.model];
      b.count += 1;
      b.cost += c.cost_usd;
      b.in += c.input_tokens;
      b.out += c.output_tokens;
    }
    const lines: string[] = ["## Cost breakdown", ""];
    for (const [tier, b] of Object.entries(byTier)) {
      if (b.count === 0) continue;
      lines.push(
        `- **${tier}**: ${b.count} calls · ${b.in.toLocaleString()}→${b.out.toLocaleString()} tokens · $${b.cost.toFixed(4)}`,
      );
    }
    lines.push("", `**Total: $${this.totalUsd.toFixed(4)}**`);
    return lines.join("\n");
  }
}

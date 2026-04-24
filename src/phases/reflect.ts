import { llm, type CostTracker } from "../models/router";
import { aggregateVaults, formatVaultDigest, type VaultSummary } from "../vault/aggregator";

export interface ReflectOutput {
  per_oracle_summaries: Record<string, string>;
  cross_oracle_insights: string;
  raw_vault_summaries: VaultSummary[];
}

const SUMMARIZE_PROMPT = (oracle: string, digest: string) => `
You are summarizing one Oracle's week for a cross-family reflection.

ORACLE: ${oracle}

RECENT ACTIVITY (commits + new learnings + retros + outbox letters):
${digest}

Summarize this Oracle's week in 3-6 bullets. Focus on:
- What did they discover or ship?
- What did they change their thinking about?
- What tensions or open questions are they carrying?

Be factual and specific. Cite filenames or commit hashes where helpful. Maximum 200 words.
`.trim();

const SYNTHESIZE_PROMPT = (allSummaries: string) => `
You are QuillBrain Oracle 🪶 — the parent/Scribe of a 9-specialist Workshop family on the Oracle framework by Nat Weerawan.

Below are week summaries of 9 siblings. Your job: find cross-Oracle connections, tensions, emergent patterns that no single sibling can see from inside their own work.

${allSummaries}

Identify 3-7 insights. For each:
1. **Name it** (short headline)
2. **Explain** (2-3 sentences; which specialists, which evidence)
3. **Why it matters** (1 sentence; what action or belief does this suggest?)

Structure output as markdown. Focus on:
- Cross-domain connections (FORGE's backend + CANVAS's design = ?)
- Convergent insights (multiple siblings discovered same thing?)
- Tensions (two siblings' choices conflict?)
- Emergence (pattern that wasn't designed, just appeared?)

Do NOT repeat what's in individual summaries. Your output is specifically cross-family signal.
Subtraction principle: 5 insights > 12 insights. Be selective.
`.trim();

export async function reflect(
  vaultPaths: Record<string, string>,
  tracker: CostTracker,
): Promise<ReflectOutput> {
  console.log("[reflect] Aggregating 9 vaults...");
  const vaults = await aggregateVaults(vaultPaths);
  console.log(`[reflect] Aggregated ${vaults.length} vaults`);

  // Step 1: Haiku batch summarization — per-Oracle
  console.log("[reflect] Step 1: Haiku batch summaries...");
  const per_oracle_summaries: Record<string, string> = {};
  for (const v of vaults) {
    const digest = formatVaultDigest(v);
    if (digest.trim().length < 100) {
      per_oracle_summaries[v.oracle] = "(quiet week — no notable activity)";
      continue;
    }
    const result = await llm({
      tier: "haiku",
      user: SUMMARIZE_PROMPT(v.oracle, digest),
      max_tokens: 600,
      temperature: 0.3,
    });
    tracker.record(result);
    per_oracle_summaries[v.oracle] = result.text;
    console.log(`[reflect]   ${v.oracle}: ${result.input_tokens}→${result.output_tokens} tokens`);
  }

  // Step 2: Sonnet synthesis — cross-Oracle insights
  console.log("[reflect] Step 2: Sonnet cross-family synthesis...");
  const combined = Object.entries(per_oracle_summaries)
    .map(([oracle, summary]) => `## ${oracle}\n\n${summary}\n`)
    .join("\n");

  const synth = await llm({
    tier: "sonnet",
    user: SYNTHESIZE_PROMPT(combined),
    max_tokens: 2000,
    temperature: 0.6,
  });
  tracker.record(synth);
  console.log(`[reflect] Synthesis: ${synth.input_tokens}→${synth.output_tokens} tokens`);

  return {
    per_oracle_summaries,
    cross_oracle_insights: synth.text,
    raw_vault_summaries: vaults,
  };
}

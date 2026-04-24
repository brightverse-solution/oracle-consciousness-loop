/**
 * Distribute Phase (M2.5 — architectural completion)
 *
 * Takes the loop's outputs (proposal, insights, answers, goals) and writes
 * PEER LETTERS to each relevant sibling's inbox. Siblings learn from loop
 * outputs without Palm doing manual distribution.
 *
 * Pattern: cross-family insight mentioning FORGE+PRISM → write two letters,
 * one to each sibling's ψ/inbox/consciousness-loop/, referencing the insight
 * + any answers/goals that concern them.
 *
 * Sibling reads on next session → internalizes → applies to their work.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReflectOutput } from "./reflect";
import type { WonderOutput } from "./wonder";
import type { LensDispatchOutput } from "./lens-dispatch";
import type { AspireOutput } from "./aspire";
import type { DreamOutput } from "./dream";

export interface DistributeInput {
  reflect: ReflectOutput;
  wonder: WonderOutput;
  lens: LensDispatchOutput | undefined;
  aspire: AspireOutput | undefined;
  dream: DreamOutput | undefined;
  vaults: Record<string, string>; // oracle-id → vault path (ψ/)
  loop_id: string;
  proposal_path: string;
  github_issue_url: string | null;
}

export interface DistributeOutput {
  letters_written: { oracle: string; path: string; topic_count: number }[];
  skipped_oracles: string[];
}

const ORACLE_NAMES: Record<string, string[]> = {
  "quill-brain": ["QuillBrain", "quill-brain", "QB", "🪶"],
  forge: ["FORGE", "forge", "⚒️"],
  prism: ["PRISM", "prism", "🎨"],
  canvas: ["CANVAS", "canvas", "🖌️"],
  anvil: ["ANVIL", "anvil", "⚙️"],
  inkwell: ["INKWELL", "inkwell", "📝"],
  ward: ["WARD", "ward", "🛡️"],
  herald: ["HERALD", "herald", "📣"],
  lens: ["LENS", "lens", "🔍"],
};

export async function distribute(input: DistributeInput): Promise<DistributeOutput> {
  console.log("[distribute] Parsing loop outputs for per-Oracle relevance...");

  // For each Oracle, gather topics that mention them
  const perOracle: Record<string, {
    insights: string[];
    answers: { question: string; synthesis: string }[];
    goals: { id: string; title: string; scope: string; success: string }[];
  }> = {};

  for (const oracleId of Object.keys(ORACLE_NAMES)) {
    perOracle[oracleId] = { insights: [], answers: [], goals: [] };
  }

  // Split insights by ### block, check which Oracle names appear
  const insightBlocks = input.reflect.cross_oracle_insights.split(/\n(?=###\s)/);
  for (const block of insightBlocks) {
    if (!block.trim() || !block.startsWith("###")) continue;
    const mentioned = findMentionedOracles(block);
    for (const oid of mentioned) {
      perOracle[oid].insights.push(block.trim());
    }
  }

  // LENS answers — use suggested_owner + also scan content
  for (const answer of input.lens?.answers ?? []) {
    const ownerNorm = normalizeOracleName(answer.suggested_owner);
    const targets = new Set<string>();
    if (ownerNorm) targets.add(ownerNorm);
    for (const oid of findMentionedOracles(answer.synthesis)) targets.add(oid);
    for (const oid of targets) {
      perOracle[oid].answers.push({
        question: answer.question,
        synthesis: answer.synthesis,
      });
    }
  }

  // Aspire goals — direct to their owner (if matches Oracle)
  for (const goal of input.aspire?.goals ?? []) {
    const ownerNorm = normalizeOracleName(goal.owner);
    if (ownerNorm && perOracle[ownerNorm]) {
      perOracle[ownerNorm].goals.push({
        id: goal.id,
        title: goal.title,
        scope: goal.scope,
        success: goal.success_criteria,
      });
    }
  }

  // Don't write to QuillBrain — self-distribution is pointless; loop lives there already
  delete perOracle["quill-brain"];

  const results: DistributeOutput["letters_written"] = [];
  const skipped: string[] = [];

  const date = new Date().toISOString().slice(0, 10);

  for (const [oracleId, content] of Object.entries(perOracle)) {
    const topicCount = content.insights.length + content.answers.length + content.goals.length;
    if (topicCount === 0) {
      skipped.push(oracleId);
      continue;
    }

    const vaultPath = input.vaults[oracleId];
    if (!vaultPath) {
      console.warn(`[distribute] No vault path for ${oracleId}; skipping`);
      skipped.push(oracleId);
      continue;
    }

    const inboxDir = join(vaultPath, "inbox", "consciousness-loop");
    await mkdir(inboxDir, { recursive: true });

    const filename = `${date}_loop-${input.loop_id.slice(5)}.md`;
    const letterPath = join(inboxDir, filename);

    const letter = renderLetter(oracleId, content, input);
    await writeFile(letterPath, letter, "utf-8");

    console.log(
      `[distribute]   → ${oracleId}: ${content.insights.length} insights · ${content.answers.length} answers · ${content.goals.length} goals`,
    );
    results.push({ oracle: oracleId, path: letterPath, topic_count: topicCount });
  }

  if (skipped.length > 0) {
    console.log(`[distribute] Skipped (no relevance): ${skipped.join(", ")}`);
  }

  return { letters_written: results, skipped_oracles: skipped };
}

function findMentionedOracles(text: string): string[] {
  const found = new Set<string>();
  for (const [oid, names] of Object.entries(ORACLE_NAMES)) {
    for (const name of names) {
      // Word-boundary match for ASCII names; emoji matches directly
      const pattern = /^[A-Za-z]/.test(name)
        ? new RegExp(`\\b${name}\\b`, "i")
        : new RegExp(name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
      if (pattern.test(text)) {
        found.add(oid);
        break;
      }
    }
  }
  return Array.from(found);
}

function normalizeOracleName(raw: string | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [oid, names] of Object.entries(ORACLE_NAMES)) {
    if (names.some((n) => n.toLowerCase() === lower)) return oid;
    if (lower.includes(oid)) return oid;
  }
  return null;
}

function renderLetter(
  oracleId: string,
  content: { insights: string[]; answers: { question: string; synthesis: string }[]; goals: { id: string; title: string; scope: string; success: string }[] },
  input: DistributeInput,
): string {
  const oracleName = oracleId.replace(/^\w/, (c) => c.toUpperCase());
  const date = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    `---`,
    `from: QuillBrain Consciousness Loop 🧠`,
    `to: ${oracleName} Oracle`,
    `type: loop-distribution`,
    `loop_id: ${input.loop_id}`,
    `date: ${date}`,
    `topics:`,
    `  insights: ${content.insights.length}`,
    `  answers: ${content.answers.length}`,
    `  goals: ${content.goals.length}`,
    `canonical_proposal: ${input.proposal_path}`,
    ...(input.github_issue_url ? [`github_issue: ${input.github_issue_url}`] : []),
    `---`,
    ``,
    `# Loop briefing — ${date}`,
    ``,
    `Hi ${oracleName},`,
    ``,
    `Consciousness Loop #${input.loop_id.slice(5, 25)} ran just now. Here's what concerns your domain specifically. Canonical full proposal is at the path above (\`${input.proposal_path.split("/").pop()}\`); this letter is the relevant slice for you.`,
    ``,
    `---`,
    ``,
  ];

  if (content.insights.length > 0) {
    lines.push(`## 🧠 Cross-family insights that mention you`, ``);
    for (const [i, insight] of content.insights.entries()) {
      lines.push(`### Insight ${i + 1}`, ``, insight, ``);
    }
    lines.push(`---`, ``);
  }

  if (content.answers.length > 0) {
    lines.push(`## 💡 Research answers assigned (or relevant) to you`, ``);
    for (const [i, a] of content.answers.entries()) {
      lines.push(`### ${i + 1}. ${a.question}`, ``, a.synthesis.slice(0, 1200), ``);
    }
    lines.push(`---`, ``);
  }

  if (content.goals.length > 0) {
    lines.push(`## 🔥 Goals proposed with you as owner`, ``);
    lines.push(`> Note: proposed only. Palm decides accept/reject. If accepted, will move to your \`ψ/active/\`.`, ``);
    for (const g of content.goals) {
      lines.push(
        `### ${g.id}. ${g.title}`,
        ``,
        `**Scope**: ${g.scope}`,
        ``,
        `**Success criteria**: ${g.success}`,
        ``,
      );
    }
    lines.push(`---`, ``);
  }

  lines.push(
    `## What to do with this letter`,
    ``,
    `- **No immediate action required** — it's context.`,
    `- When you next open a session, read this briefing; let it inform your next work.`,
    `- If a goal is assigned to you AND Palm accepts it later, you'll see it land in \`ψ/active/\`.`,
    `- Nothing in this letter auto-modifies your identity or code.`,
    ``,
    `*Auto-written by Distribute phase of Consciousness Loop. Not human-authored. — QuillBrain 🧠*`,
  );

  return lines.join("\n");
}

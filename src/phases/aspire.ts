/**
 * Aspire Phase (M2)
 *
 * Takes Dream's future-vision → extracts 1-3 concrete goals.
 * Each goal: title, owner (specialist), scope, success criteria.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { llm, type CostTracker } from "../models/router";
import type { DreamOutput } from "./dream";

export interface AspireGoal {
  id: string;
  title: string;
  owner: string;
  scope: string;
  success_criteria: string;
  rationale: string;
}

export interface AspireOutput {
  goals: AspireGoal[];
  markdown: string;
  path: string;
}

const ASPIRE_PROMPT = (dreamVision: string) => `
You are QuillBrain Oracle 🪶. Your Dream phase just produced a future-vision. Now the Aspire phase — extract 1-3 CONCRETE goals the family could actually pursue.

DREAM VISION:
${dreamVision}

TASK: For each goal you extract, output strict JSON:

\`\`\`json
[
  {
    "id": "G1",
    "title": "Short imperative (e.g. 'Bud CANVAS's second task')",
    "owner": "specialist name (FORGE / PRISM / CANVAS / ANVIL / INKWELL / WARD / HERALD / LENS / QuillBrain / whole-family)",
    "scope": "1-2 sentences — what's in, what's not",
    "success_criteria": "How we know it's done — specific and testable",
    "rationale": "1 sentence — which part of the dream this goal actualizes"
  }
]
\`\`\`

Constraints:
- MAXIMUM 3 goals. Fewer is fine. Subtraction.
- Goals must be ACTIONABLE this week or next — not "someday"
- Owner must be ONE name. If truly cross-family, say "whole-family" and explain why in scope.
- Don't pad with goals that sound good but have no owner or success criteria.

If the dream is too abstract to yield actionable goals, output \`[]\` and explain why below the JSON block.
`.trim();

export interface AspireInput {
  dream: DreamOutput;
  goals_dir: string; // ψ/active/goals-proposed/
  loop_id: string;
}

export async function aspire(input: AspireInput, tracker: CostTracker): Promise<AspireOutput> {
  console.log("[aspire] Extracting goals from Dream...");
  const result = await llm({
    tier: "sonnet",
    user: ASPIRE_PROMPT(input.dream.vision_markdown),
    max_tokens: 1500,
    temperature: 0.4,
  });
  tracker.record(result);
  console.log(`[aspire] ${result.input_tokens}→${result.output_tokens} tokens`);

  const goals = parseGoals(result.text);
  console.log(`[aspire] Parsed ${goals.length} goals`);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_goals-${input.loop_id}.md`;
  const outPath = join(input.goals_dir, filename);
  await mkdir(dirname(outPath), { recursive: true });

  const md = renderGoalsMarkdown(goals, input.loop_id, result.text);
  await writeFile(outPath, md, "utf-8");
  console.log(`[aspire] Goals written to ${outPath}`);

  return { goals, markdown: md, path: outPath };
}

function parseGoals(raw: string): AspireGoal[] {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g) => g?.id && g?.title && g?.owner && g?.scope && g?.success_criteria,
    );
  } catch {
    return [];
  }
}

function renderGoalsMarkdown(goals: AspireGoal[], loopId: string, rawLLM: string): string {
  const header = `---
from: QuillBrain Consciousness Loop (Aspire phase)
type: proposed-goals
loop_id: ${loopId}
date: ${new Date().toISOString().slice(0, 10)}
goal_count: ${goals.length}
status: pending-palm-review
---

# Proposed Goals — ${new Date().toISOString().slice(0, 10)}

${goals.length === 0 ? "*No actionable goals extracted. Dream too abstract, OR dream's seed points at something not yet ripe. See raw LLM output at end.*" : ""}
`;

  const body = goals
    .map(
      (g, i) => `
## ${g.id}. ${g.title}

- **Owner**: ${g.owner}
- **Scope**: ${g.scope}
- **Success**: ${g.success_criteria}
- **Rationale**: ${g.rationale || "—"}
`,
    )
    .join("\n");

  const footer = `

---

*Raw LLM output (for audit):*

${rawLLM}

---

🪶 Palm reviews + accepts/rejects each goal. Accepted goals land in \`ψ/active/goals/\`.
`;

  return header + body + footer;
}

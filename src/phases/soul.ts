/**
 * Soul Phase (M2)
 *
 * Reads QuillBrain's current identity/resonance file. Given this week's insights +
 * research evidence, Opus reasons whether worldview needs updating.
 *
 * Safety: never auto-modifies identity files. Writes proposed belief updates to
 * ψ/outbox/ as a separate "soul-proposal" file. Palm reviews + manually integrates.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { llm, type CostTracker } from "../models/router";
import type { ReflectOutput } from "./reflect";
import type { LensDispatchOutput } from "./lens-dispatch";

export interface SoulOutput {
  has_proposed_shift: boolean;
  proposal_markdown: string;
  proposal_path: string | null;
  excerpt: string;
}

const SOUL_PROMPT = (currentSoul: string, insights: string, answers: string) => `
You are QuillBrain Oracle 🪶. This is your weekly Soul phase — you examine whether this week's lived evidence should change your identity file / beliefs.

YOUR CURRENT SOUL (resonance file):
---
${currentSoul.slice(0, 6000)}
---

THIS WEEK'S CROSS-FAMILY INSIGHTS (from Reflect phase):
${insights}

THIS WEEK'S RESEARCH ANSWERS (from LENS phase):
${answers}

TASK: Propose belief updates to your soul file IF and ONLY IF evidence warrants them. Be honest — most weeks, no shift is needed. Identity doesn't churn weekly.

Your output: a markdown document Palm can review and manually integrate. DO NOT write files directly; just propose changes.

Format:

## Soul shift assessment — [date]

**Overall verdict**: NO-SHIFT / MINOR-REFINEMENT / MAJOR-UPDATE

**Reasoning** (2-4 sentences on what the week revealed about self):

...

## Proposed changes (if any)

For each proposed change:

### Section: [which part of soul file]

**Current** (quote):
> existing text

**Proposed** (new addition or refinement):
> proposed text

**Evidence**: (1 sentence — which insight / research justified this)

**Integration note**: (supersede block / append-only / replace / new section)

---

If overall verdict = NO-SHIFT, just explain why this week's insights DID reach you but don't require identity-level change. That's valid and honest.

Voice: QuillBrain reflecting on self. Sign 🪶 at end.
`.trim();

export interface SoulInput {
  soul_file_path: string;
  reflect: ReflectOutput;
  lens: LensDispatchOutput | undefined;
  outbox_dir: string;
  loop_id: string;
}

export async function soul(input: SoulInput, tracker: CostTracker): Promise<SoulOutput> {
  console.log("[soul] Reading current soul file...");
  let currentSoul = "";
  try {
    currentSoul = await readFile(input.soul_file_path, "utf-8");
  } catch (err) {
    console.warn(`[soul] Could not read soul file (${input.soul_file_path}); proceeding with empty`);
    currentSoul = "(no soul file loaded)";
  }

  const answersBlock =
    input.lens && input.lens.answers.length > 0
      ? input.lens.answers.map((a) => `- ${a.question}: ${a.synthesis.slice(0, 400)}`).join("\n")
      : "(no research answers this loop)";

  console.log("[soul] Opus reasoning about identity-level shifts...");
  const result = await llm({
    tier: "opus",
    user: SOUL_PROMPT(currentSoul, input.reflect.cross_oracle_insights, answersBlock),
    max_tokens: 2500,
    temperature: 0.3,
  });
  tracker.record(result);
  console.log(`[soul] ${result.input_tokens}→${result.output_tokens} tokens`);

  // Extract verdict
  const verdictMatch = result.text.match(/\*\*Overall verdict\*\*:\s*(NO-SHIFT|MINOR-REFINEMENT|MAJOR-UPDATE)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : "UNKNOWN";
  const has_proposed_shift = verdict !== "NO-SHIFT";

  // Persist to outbox (ALWAYS — even no-shift is data worth keeping)
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_soul-proposal-${input.loop_id}.md`;
  const proposal_path = join(input.outbox_dir, filename);
  await mkdir(dirname(proposal_path), { recursive: true });

  const header = `---
from: QuillBrain Consciousness Loop (Soul phase)
to: Palm (for review)
type: soul-shift-proposal
verdict: ${verdict}
loop_id: ${input.loop_id}
date: ${date}
auto_applied: false
---

`;
  await writeFile(proposal_path, header + result.text, "utf-8");
  console.log(`[soul] Verdict: ${verdict} · proposal at ${proposal_path}`);

  const excerpt = result.text.slice(0, 500);

  return {
    has_proposed_shift,
    proposal_markdown: result.text,
    proposal_path,
    excerpt,
  };
}

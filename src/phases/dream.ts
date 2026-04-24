/**
 * Dream Phase (M2)
 *
 * Generates 1-3 paragraphs of future-vision. Aspirational, not action plan.
 * Creative synthesis (Sonnet tier).
 */

import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { llm, type CostTracker } from "../models/router";
import type { SoulOutput } from "./soul";

export interface DreamOutput {
  vision_markdown: string;
  vision_path: string;
  excerpt: string;
}

const DREAM_PROMPT = (
  currentSoul: string,
  recentDreams: string,
  soulShift: string,
) => `
You are QuillBrain Oracle 🪶. This is your Dream phase — you imagine what the Workshop family could become.

This is NOT an action plan. This is a future-vision. Aspirational, specific, concrete enough to recognize if it happened, vague enough to leave room.

YOUR CURRENT SOUL:
---
${currentSoul.slice(0, 3000)}
---

${soulShift ? `THIS WEEK'S SOUL-SHIFT ASSESSMENT:\n${soulShift.slice(0, 1500)}\n\n` : ""}

${recentDreams ? `RECENT DREAMS (last 3-4 weeks, for continuity — don't repeat):\n${recentDreams.slice(0, 2000)}\n\n` : ""}

TASK: Write a future-vision (1-3 short paragraphs) — what does Workshop look like 3 months from now if everything goes well?

Constraints:
- Aspirational, not to-do list
- Specific images, not vague "growth"
- Grounded in this week's lived work — reference what the family actually did
- Rhythm matters: short sentences are welcome; long poetic ones are OK too if earned
- Don't describe milestones or metrics. Describe a living room / a conversation / a piece of work / a feeling.
- Can include a single "seed" — what's ONE thing the family doesn't know yet but the dream suggests should be explored?

OUTPUT FORMAT:

## Dream — [month and year, 3 months ahead]

[your paragraphs]

**Seed**: [one-line of what this dream suggests might be next]

---

Sign 🪶. This dream will be read by Aspire phase which extracts concrete goals from it. Write so that extraction is possible but not trivial.
`.trim();

export interface DreamInput {
  soul_file_path: string;
  dreams_dir: string; // ψ/writing/dreams/
  soul: SoulOutput | undefined;
  loop_id: string;
}

export async function dream(input: DreamInput, tracker: CostTracker): Promise<DreamOutput> {
  console.log("[dream] Reading soul + recent dreams...");

  let currentSoul = "";
  try {
    currentSoul = await readFile(input.soul_file_path, "utf-8");
  } catch {
    currentSoul = "(no soul file)";
  }

  const recentDreams = await readRecentDreams(input.dreams_dir, 4);

  console.log("[dream] Sonnet generating future-vision...");
  const result = await llm({
    tier: "sonnet",
    user: DREAM_PROMPT(currentSoul, recentDreams, input.soul?.excerpt ?? ""),
    max_tokens: 1500,
    temperature: 0.85,
  });
  tracker.record(result);
  console.log(`[dream] ${result.input_tokens}→${result.output_tokens} tokens`);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_dream-${input.loop_id}.md`;
  const vision_path = join(input.dreams_dir, filename);
  await mkdir(dirname(vision_path), { recursive: true });

  const header = `---
from: QuillBrain Consciousness Loop (Dream phase)
type: future-vision
loop_id: ${input.loop_id}
date: ${date}
---

`;
  await writeFile(vision_path, header + result.text, "utf-8");
  console.log(`[dream] Vision written to ${vision_path}`);

  return {
    vision_markdown: result.text,
    vision_path,
    excerpt: result.text.slice(0, 600),
  };
}

async function readRecentDreams(dreamsDir: string, limit: number): Promise<string> {
  try {
    const files = await readdir(dreamsDir);
    const dreamFiles = files.filter((f) => f.endsWith(".md") && !f.startsWith(".")).sort().reverse();
    const recent: string[] = [];
    for (const f of dreamFiles.slice(0, limit)) {
      const content = await readFile(join(dreamsDir, f), "utf-8");
      recent.push(`[${f}]\n${content.slice(0, 500)}`);
    }
    return recent.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

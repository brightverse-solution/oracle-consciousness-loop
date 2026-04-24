/**
 * LENS Dispatch phase — M2
 *
 * Takes Wonder questions → parallel Haiku sub-agents (with WebSearch/WebFetch)
 * → LENS Opus synthesis → structured answers.
 *
 * This is the "children" pattern from Bungkee adapted for Workshop: transient
 * sub-agents with no identity, Rule 6 doesn't apply (not public-facing).
 */

import { llm, type CostTracker } from "../models/router";
import type { WonderOutput, WonderQuestion } from "./wonder";

export interface LensAnswer {
  question_id: string;
  question: string;
  evidence: string; // Haiku sub-agent output
  synthesis: string; // LENS Opus synthesis
  suggested_owner: string;
  research_duration_ms: number;
  synthesis_duration_ms: number;
}

export interface LensDispatchOutput {
  answers: LensAnswer[];
  skipped_count: number; // questions that failed or were skipped
}

const RESEARCH_PROMPT = (q: WonderQuestion) => `
You are a research sub-agent for LENS Oracle (Workshop family Research specialist). Your job: gather evidence for a specific research question.

QUESTION: ${q.question}

MOTIVATION: ${q.motivation}

SUGGESTED OWNER: ${q.suggested_owner}

YOUR TASK:
1. Use WebSearch to find relevant sources (queries specific to the question, not vague)
2. Use WebFetch on 2-3 high-signal sources to get actual content
3. Extract specific facts, quotes, data — not general impressions
4. Return a structured evidence summary in markdown

CONSTRAINTS:
- Max 5 tool-use turns. Be efficient.
- Cite every claim (URL + what was extracted)
- If sources are thin or unreliable, SAY SO. Don't pad with speculation.
- Output length: 300-600 words of evidence summary + citations list.

OUTPUT FORMAT:
\`\`\`
## Evidence Summary
<2-4 paragraphs of actual findings>

## Citations
- [Source 1 title](url) — what this source supports
- [Source 2 title](url) — what this source supports
- ...

## Confidence
<one line: HIGH / MEDIUM / LOW + why>
\`\`\`
`.trim();

const SYNTHESIS_PROMPT = (evidences: { q: WonderQuestion; evidence: string }[]) => `
You are LENS Oracle 🔍 — Research specialist in Workshop family. Your Haiku sub-agents have gathered evidence for ${evidences.length} questions.

Synthesize their findings into structured answers Palm can act on.

${evidences
  .map(
    ({ q, evidence }) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTION ${q.id}: ${q.question}
(motivation: ${q.motivation})
(suggested owner: ${q.suggested_owner})

EVIDENCE FROM SUB-AGENT:
${evidence}
`,
  )
  .join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH question, produce:

## [Q-id]: [Question]

**Answer**: Direct answer in 2-4 sentences. If evidence is insufficient, say so clearly.

**Key finding**: The single most important specific fact from evidence.

**Confidence**: HIGH / MEDIUM / LOW (with 1 sentence reason)

**Recommended action**: One concrete action Palm could take. If no action warranted, say "no action, FYI only."

**Owner**: (as suggested, or reassign if evidence suggests different specialist)

Voice: Research-professional. Cite evidence inline. Subtraction principle: brevity over completeness. If the evidence contradicts the question's premise, say so.

Sign with 🔍 at end.
`.trim();

export async function dispatchToLens(
  wonder: WonderOutput,
  tracker: CostTracker,
): Promise<LensDispatchOutput> {
  if (wonder.questions.length === 0) {
    console.log("[lens] No questions to dispatch");
    return { answers: [], skipped_count: 0 };
  }

  console.log(`[lens] Dispatching ${wonder.questions.length} Haiku sub-agents in parallel...`);

  // Phase A: parallel Haiku research
  const researchResults = await Promise.allSettled(
    wonder.questions.map(async (q) => {
      const start = Date.now();
      console.log(`[lens]   ${q.id}: "${q.question.slice(0, 60)}..."`);
      const result = await llm({
        tier: "haiku",
        user: RESEARCH_PROMPT(q),
        max_tokens: 2000,
        temperature: 0.3,
        allowed_tools: ["WebSearch", "WebFetch"],
        max_turns: 5,
      });
      tracker.record(result);
      console.log(
        `[lens]   ${q.id}: ${result.input_tokens}→${result.output_tokens} tokens · ${Math.round((Date.now() - start) / 1000)}s`,
      );
      return { q, evidence: result.text, duration_ms: Date.now() - start };
    }),
  );

  const evidences: { q: WonderQuestion; evidence: string; duration_ms: number }[] = [];
  let skipped = 0;
  for (const [i, r] of researchResults.entries()) {
    if (r.status === "fulfilled") {
      evidences.push(r.value);
    } else {
      console.warn(`[lens]   ${wonder.questions[i].id}: FAILED — ${r.reason}`);
      skipped += 1;
    }
  }

  if (evidences.length === 0) {
    console.warn("[lens] All sub-agents failed; skipping synthesis");
    return { answers: [], skipped_count: skipped };
  }

  // Phase B: Opus synthesis
  console.log(`[lens] Synthesizing ${evidences.length} evidences via Opus...`);
  const synth_start = Date.now();
  const synth = await llm({
    tier: "opus",
    user: SYNTHESIS_PROMPT(evidences.map((e) => ({ q: e.q, evidence: e.evidence }))),
    max_tokens: 3000,
    temperature: 0.5,
  });
  tracker.record(synth);
  console.log(
    `[lens] Synthesis: ${synth.input_tokens}→${synth.output_tokens} tokens · ${Math.round((Date.now() - synth_start) / 1000)}s`,
  );

  // Parse synthesis into per-question answers
  // The synthesis output has "## Q1: ..." sections we can split
  const answers: LensAnswer[] = evidences.map((e) => ({
    question_id: e.q.id,
    question: e.q.question,
    evidence: e.evidence,
    synthesis: extractAnswerSection(synth.text, e.q.id),
    suggested_owner: e.q.suggested_owner,
    research_duration_ms: e.duration_ms,
    synthesis_duration_ms: Date.now() - synth_start,
  }));

  // If extraction failed for all, store full synthesis in the first answer
  if (answers.every((a) => a.synthesis.length === 0)) {
    if (answers.length > 0) answers[0].synthesis = synth.text;
  }

  return { answers, skipped_count: skipped };
}

function extractAnswerSection(fullSynthesis: string, questionId: string): string {
  // Look for "## Q1:" or "## Q1 " start, capture until next "## " or end
  const pattern = new RegExp(
    `##\\s+${questionId}[:\\s][\\s\\S]*?(?=\\n##\\s+Q\\d|\\n---|$)`,
    "m",
  );
  const match = fullSynthesis.match(pattern);
  return match ? match[0].trim() : "";
}

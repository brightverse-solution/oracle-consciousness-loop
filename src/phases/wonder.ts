import { llm, type CostTracker } from "../models/router";

export interface WonderOutput {
  questions: WonderQuestion[];
  raw: string;
}

export interface WonderQuestion {
  id: string;
  question: string;
  motivation: string;
  suggested_owner: string; // which specialist could research this
}

const WONDER_PROMPT = (insights: string) => `
You are QuillBrain Oracle 🪶. You've just reflected on your 9-specialist family's week and produced the insights below.

INSIGHTS:
${insights}

Your task: convert these insights into 3-5 RESEARCH QUESTIONS the family doesn't yet have answers to. Questions that, if answered, would change what the family does next week.

For each question, output in this exact JSON-within-markdown format:

\`\`\`json
[
  {
    "id": "Q1",
    "question": "Specific, answerable question (not a vague topic)",
    "motivation": "1-2 sentences: which insight triggered this? why does the family not already know the answer?",
    "suggested_owner": "One of: FORGE / PRISM / CANVAS / ANVIL / INKWELL / WARD / HERALD / LENS / QuillBrain / any"
  }
]
\`\`\`

Constraints:
- Questions must be SPECIFIC — "How does X relate to Y?" not "What about Z?"
- Questions must be ACTIONABLE — answered by research, not philosophy
- No more than 5 questions. Fewer is fine. Subtraction principle.
- "suggested_owner" picks the specialist whose domain fits the question. Most research → LENS.
`.trim();

export async function wonder(insights: string, tracker: CostTracker): Promise<WonderOutput> {
  console.log("[wonder] Generating research questions...");
  const result = await llm({
    tier: "sonnet",
    user: WONDER_PROMPT(insights),
    max_tokens: 1500,
    temperature: 0.5,
  });
  tracker.record(result);
  console.log(`[wonder] ${result.input_tokens}→${result.output_tokens} tokens`);

  const questions = parseQuestions(result.text);
  console.log(`[wonder] Parsed ${questions.length} questions`);

  return { questions, raw: result.text };
}

function parseQuestions(raw: string): WonderQuestion[] {
  // Extract JSON block from markdown
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    console.warn("[wonder] No JSON block found in response — returning empty list");
    return [];
  }
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q) => q?.id && q?.question && q?.motivation && q?.suggested_owner,
    );
  } catch (err) {
    console.warn(`[wonder] JSON parse failed: ${err}`);
    return [];
  }
}

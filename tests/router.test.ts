/**
 * Smoke test for router.ts — verifies Claude CLI subprocess + JSON parsing.
 * Run: bun test tests/router.test.ts
 */
import { test, expect } from "bun:test";
import { llm, CostTracker } from "../src/models/router";

test("haiku round-trip via CLI", async () => {
  const result = await llm({
    tier: "haiku",
    user: "Reply with only the number 42. No other text.",
    max_tokens: 10,
  });
  expect(result.text).toContain("42");
  expect(result.input_tokens).toBeGreaterThan(0);
  expect(result.output_tokens).toBeGreaterThan(0);
  expect(result.duration_ms).toBeGreaterThan(0);
}, 30_000);

test("CostTracker aggregates", () => {
  const t = new CostTracker();
  t.record({
    text: "x",
    model: "haiku",
    input_tokens: 100,
    output_tokens: 10,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    cost_usd: 0.01,
    duration_ms: 100,
  });
  t.record({
    text: "y",
    model: "sonnet",
    input_tokens: 200,
    output_tokens: 20,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    cost_usd: 0.03,
    duration_ms: 200,
  });
  expect(t.totalUsd).toBeCloseTo(0.04, 5);
  expect(t.totalCalls).toBe(2);
  expect(t.summary()).toContain("haiku");
  expect(t.summary()).toContain("sonnet");
});

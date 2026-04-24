<script lang="ts">
  import { marked } from "marked";
  import type { LoopLog } from "../lib/types";

  let { loop, proposal }: { loop: LoopLog; proposal: string | undefined } = $props();

  const rendered = $derived(proposal ? marked.parse(proposal) : "");
</script>

<div class="detail">
  <div class="head card">
    <div class="metrics">
      <div>
        <div class="metric-label">Loop</div>
        <div class="mono small">{loop.loop_id}</div>
      </div>
      <div>
        <div class="metric-label">Duration</div>
        <div class="metric-small">{Math.round(loop.duration_s)}s</div>
      </div>
      <div>
        <div class="metric-label">Cost</div>
        <div class="metric-small">${loop.cost_usd.toFixed(4)}</div>
      </div>
      <div>
        <div class="metric-label">Questions</div>
        <div class="metric-small">{loop.questions_generated}</div>
      </div>
      <div>
        <div class="metric-label">Oracles</div>
        <div class="metric-small">{loop.oracles_summarized}/9</div>
      </div>
    </div>
    {#if loop.github_issue_url}
      <a href={loop.github_issue_url} target="_blank" rel="noreferrer">View on GitHub ↗</a>
    {/if}
  </div>

  {#if proposal}
    <article class="prose">
      {@html rendered}
    </article>
  {:else}
    <p class="muted">Proposal markdown not found for this loop.</p>
  {/if}
</div>

<style>
  .detail { display: flex; flex-direction: column; gap: 1.5rem; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .metrics { display: flex; gap: 2rem; flex-wrap: wrap; }
  .small { font-size: 0.85rem; }
  .metric-small { font-size: 1.1rem; font-weight: 600; }
</style>

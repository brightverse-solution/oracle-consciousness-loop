<script lang="ts">
  import type { LoopLog } from "../lib/types";
  let { loops }: { loops: LoopLog[] } = $props();

  const totalCost = $derived(loops.reduce((s, l) => s + l.cost_usd, 0));
  const totalDuration = $derived(loops.reduce((s, l) => s + l.duration_s, 0));
  const totalQuestions = $derived(loops.reduce((s, l) => s + l.questions_generated, 0));
  const latest = $derived(loops[0]);
</script>

<div class="grid">
  <div class="card">
    <div class="metric-label">Total loops</div>
    <div class="metric">{loops.length}</div>
  </div>
  <div class="card">
    <div class="metric-label">Total cost (subscription-absorbed)</div>
    <div class="metric">${totalCost.toFixed(4)}</div>
  </div>
  <div class="card">
    <div class="metric-label">Total duration</div>
    <div class="metric">{Math.round(totalDuration)}s</div>
  </div>
  <div class="card">
    <div class="metric-label">Questions generated</div>
    <div class="metric">{totalQuestions}</div>
  </div>
  {#if latest}
    <div class="card">
      <div class="metric-label">Latest loop · cost</div>
      <div class="metric">${latest.cost_usd.toFixed(4)}</div>
    </div>
    <div class="card">
      <div class="metric-label">Latest loop · oracles summarized</div>
      <div class="metric">{latest.oracles_summarized}/9</div>
    </div>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
</style>

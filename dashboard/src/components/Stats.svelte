<script lang="ts">
  import type { LoopLog } from "../lib/types";
  let { loops }: { loops: LoopLog[] } = $props();

  const totalCost = $derived(loops.reduce((s, l) => s + l.cost_usd, 0));
  const totalDuration = $derived(loops.reduce((s, l) => s + l.duration_s, 0));
  const totalQuestions = $derived(loops.reduce((s, l) => s + l.questions_generated, 0));
  const latest = $derived(loops[0]);

  function humanAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
</script>

<div class="grid">
  <div class="card stat">
    <div class="metric accent">{loops.length}</div>
    <div class="metric-label">Total Loops</div>
  </div>
  <div class="card stat">
    <div class="metric" style="color: var(--warn)">{latest ? humanAgo(latest.ended) : "—"}</div>
    <div class="metric-label">Since Last Loop</div>
  </div>
  <div class="card stat">
    <div class="metric" style="color: var(--success)">{latest ? humanAgo(latest.ended) + " ago" : "—"}</div>
    <div class="metric-label">Last Success</div>
  </div>
  <div class="card stat">
    <div class="metric" style="color: var(--danger)">0</div>
    <div class="metric-label">Failures</div>
  </div>
  <div class="card stat">
    <div class="metric">${totalCost.toFixed(4)}</div>
    <div class="metric-label">Total Cost (subscription-absorbed)</div>
  </div>
  <div class="card stat">
    <div class="metric">{totalQuestions}</div>
    <div class="metric-label">Questions Generated</div>
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.875rem;
    margin: 1rem 0;
  }
  .stat { padding: 1.25rem; }
  .accent { color: var(--accent); }
</style>

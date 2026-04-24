<script lang="ts">
  import type { LoopLog } from "../lib/types";

  let {
    loops,
    selected,
    onselect,
  }: {
    loops: LoopLog[];
    selected: LoopLog | null;
    onselect: (l: LoopLog) => void;
  } = $props();

  function timeLabel(iso: string): string {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
  }
</script>

<div class="list">
  <h4>Loops ({loops.length})</h4>
  {#each loops as loop (loop.loop_id)}
    <button
      class="item"
      class:selected={selected?.loop_id === loop.loop_id}
      onclick={() => onselect(loop)}
    >
      <div class="id">{loop.loop_id}</div>
      <div class="meta">
        <span>{timeLabel(loop.started)}</span>
        <span>·</span>
        <span>{Math.round(loop.duration_s)}s</span>
        <span>·</span>
        <span>${loop.cost_usd.toFixed(4)}</span>
      </div>
    </button>
  {/each}
  {#if loops.length === 0}
    <p class="muted">No loops yet.</p>
  {/if}
</div>

<style>
  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .item {
    display: block;
    text-align: left;
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
  }
  .item:hover { border-color: var(--accent); }
  .item.selected { background: var(--grand-bg); color: white; border-color: var(--grand-bg); }
  .id { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 500; word-break: break-all; }
  .meta { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .item.selected .meta { color: rgba(255, 255, 255, 0.7); }
</style>

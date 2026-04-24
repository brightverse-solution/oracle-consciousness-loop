<script lang="ts">
  import type { OracleInfo } from "../lib/types";
  let { family }: { family: OracleInfo[] } = $props();
</script>

<div class="grid">
  {#each family as oracle (oracle.name)}
    <div class="card oracle">
      <div class="top">
        <div class="emoji">{oracle.emoji}</div>
        <div class="name-block">
          <div class="name">{oracle.name}</div>
          <div class="muted small">{oracle.role}</div>
        </div>
      </div>
      <div class="foot">
        <span class="chip">{oracle.model}</span>
        {#if oracle.registry !== "—"}
          <span class="muted small">ARRA {oracle.registry}</span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .oracle { display: flex; flex-direction: column; gap: 1rem; }
  .top { display: flex; gap: 1rem; align-items: center; }
  .emoji { font-size: 2.5rem; line-height: 1; }
  .name { font-weight: 600; font-size: 1.1rem; }
  .small { font-size: 0.8rem; }
  .foot { display: flex; justify-content: space-between; align-items: center; }
  .chip {
    font-size: 0.75rem;
    background: var(--totals-bg);
    padding: 2px 8px;
    border-radius: 12px;
    color: var(--ink);
  }
</style>

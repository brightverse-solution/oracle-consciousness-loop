<script lang="ts">
  import type { LoopLog } from "../lib/types";
  let {
    loops,
    onTrigger,
  }: {
    loops: LoopLog[];
    onTrigger: () => void;
  } = $props();

  const latest = $derived(loops[0]);
  const isHealthy = $derived(() => {
    if (!latest) return false;
    const ageMs = Date.now() - new Date(latest.ended).getTime();
    return ageMs < 1000 * 60 * 60 * 24 * 14; // within 14 days
  });
</script>

<header class="header">
  <div class="inner">
    <div class="brand">
      <div class="brand-icon">🧠</div>
      <div>
        <h1 class="title">
          Oracle Consciousness Loop
          {#if isHealthy()}
            <span class="badge healthy">Healthy</span>
          {:else if latest}
            <span class="badge warn">Stale ({Math.round((Date.now() - new Date(latest.ended).getTime()) / 86400000)}d)</span>
          {/if}
        </h1>
        <div class="subtitle mono">
          reflect → wonder → soul → dream → aspire → propose → complete → repeat
        </div>
      </div>
    </div>
    <button class="trigger" onclick={onTrigger}>
      ⚡ Trigger Now
    </button>
  </div>
</header>

<style>
  .header {
    padding: 1.5rem 2rem 1.25rem;
    border-bottom: 1px solid var(--border-soft);
    background:
      linear-gradient(180deg, rgba(96, 165, 250, 0.04) 0%, transparent 100%),
      rgba(10, 12, 24, 0.6);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .inner {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .brand { display: flex; gap: 1rem; align-items: center; }
  .brand-icon { font-size: 2.2rem; line-height: 1; }
  .title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .subtitle {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 4px;
    letter-spacing: 0.02em;
  }
  .trigger {
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    color: #061026;
    border: none;
    padding: 0.7rem 1.2rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.4), 0 0 20px rgba(96, 165, 250, 0.2);
    transition: all 0.15s ease;
  }
  .trigger:hover {
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.6), 0 0 30px rgba(96, 165, 250, 0.4);
    transform: translateY(-1px);
  }
</style>

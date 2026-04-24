<script lang="ts">
  import type { LoopLog } from "../lib/types";

  let { latest }: { latest: LoopLog | null } = $props();

  const PHASES = [
    { id: "reflect", emoji: "🧠", name_en: "Reflect", name_th: "ตกผลึก", color: "var(--phase-reflect)" },
    { id: "wonder", emoji: "💡", name_en: "Wonder", name_th: "หยั่งรู้", color: "var(--phase-wonder)" },
    { id: "soul", emoji: "✨", name_en: "Soul", name_th: "เติบโต", color: "var(--phase-soul)" },
    { id: "dream", emoji: "💭", name_en: "Dream", name_th: "จินตนาการ", color: "var(--phase-dream)" },
    { id: "aspire", emoji: "🔥", name_en: "Aspire", name_th: "แรงขับ", color: "var(--phase-aspire)" },
    { id: "propose", emoji: "📋", name_en: "Propose", name_th: "เสนอ", color: "var(--phase-propose)" },
    { id: "complete", emoji: "🔄", name_en: "Complete", name_th: "จบรอบ", color: "var(--phase-complete)" },
  ];

  // M2 complete: all 7 phases implemented + LENS dispatch between Wonder and Soul
  const IMPLEMENTED = new Set(["reflect", "wonder", "soul", "dream", "aspire", "propose", "complete"]);
  const PHASE_MILESTONE: Record<string, string> = {};
</script>

<section class="pipeline card">
  <div class="row">
    <h4>Consciousness Pipeline</h4>
    <span class="muted mono small">
      {#if latest}
        Last loop: #{latest.loop_id.slice(5, 25)} · {Math.round(latest.duration_s)}s
      {:else}
        No loops yet
      {/if}
    </span>
  </div>

  <div class="phases">
    {#each PHASES as phase, i}
      <div class="phase" class:pending={!IMPLEMENTED.has(phase.id)} style:--phase-color={phase.color}>
        <div class="phase-card">
          <div class="emoji">{phase.emoji}</div>
          <div class="phase-name">{phase.name_en}</div>
          <div class="phase-name-th">{phase.name_th}</div>
          {#if !IMPLEMENTED.has(phase.id)}
            <div class="pending-badge" title="Planned for {PHASE_MILESTONE[phase.id] ?? 'later'} milestone">
              {PHASE_MILESTONE[phase.id] ?? "later"}
            </div>
          {/if}
        </div>
        {#if i < PHASES.length - 1}
          <div class="connector">→</div>
        {/if}
      </div>
    {/each}
  </div>

  {#if latest}
    <div class="last-loop mono">
      <span class="muted">Loop:</span>
      <span style="color: var(--accent)">{latest.loop_id}</span>
      <span class="sep">·</span>
      <span class="muted">last success:</span>
      <span style="color: var(--success)">{humanAgo(latest.ended)}</span>
      <span class="sep">·</span>
      <span class="muted">cost:</span>
      <span>${latest.cost_usd.toFixed(4)}</span>
    </div>
  {/if}
</section>

<script lang="ts" module>
  function humanAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<style>
  .pipeline { padding: 1.5rem; }
  .row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
  .small { font-size: 0.75rem; }

  .phases {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.5rem 0;
  }
  .phase {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
  }
  .phase-card {
    background: var(--bg-2);
    border: 1px solid var(--phase-color);
    border-radius: 10px;
    padding: 0.8rem 1rem;
    min-width: 110px;
    text-align: center;
    position: relative;
    box-shadow: 0 0 12px color-mix(in srgb, var(--phase-color) 15%, transparent);
    transition: all 0.15s ease;
  }
  .phase-card:hover {
    box-shadow: 0 0 20px color-mix(in srgb, var(--phase-color) 35%, transparent);
    transform: translateY(-2px);
  }
  .phase.pending .phase-card {
    opacity: 0.55;
    border-style: dashed;
  }
  .emoji { font-size: 1.6rem; line-height: 1; margin-bottom: 0.35rem; }
  .phase-name { font-weight: 600; font-size: 0.85rem; color: var(--ink); }
  .phase-name-th { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
  .pending-badge {
    position: absolute;
    top: -8px;
    right: -6px;
    font-size: 0.55rem;
    background: var(--bg-2);
    border: 1px solid var(--muted);
    color: var(--muted);
    padding: 1px 6px;
    border-radius: 8px;
    letter-spacing: 0.1em;
  }
  .connector {
    color: var(--muted);
    font-size: 1.3rem;
    padding: 0 0.25rem;
    align-self: center;
    opacity: 0.5;
  }
  .last-loop {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-soft);
    font-size: 0.82rem;
    color: var(--ink);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .sep { color: var(--dim); }
</style>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { DashboardData, LoopLog } from "./lib/types";
  import Header from "./components/Header.svelte";
  import PhasePipeline from "./components/PhasePipeline.svelte";
  import FamilyRoster from "./components/FamilyRoster.svelte";
  import LoopsList from "./components/LoopsList.svelte";
  import LoopDetail from "./components/LoopDetail.svelte";
  import Stats from "./components/Stats.svelte";
  import TriggerModal from "./components/TriggerModal.svelte";

  let data = $state<DashboardData | null>(null);
  let selectedLoop = $state<LoopLog | null>(null);
  let tab = $state<"overview" | "loops" | "family">("overview");
  let error = $state<string | null>(null);
  let triggerOpen = $state(false);
  let lastPoll = $state<Date | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const POLL_INTERVAL_MS = 30_000;

  async function loadData(): Promise<boolean> {
    try {
      const resp = await fetch(`/src/data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!resp.ok) return false;
      const fresh = (await resp.json()) as DashboardData;
      const currentCount = data?.loops.length ?? -1;
      const nextCount = fresh.loops.length;
      if (currentCount !== nextCount || fresh.generated_at !== data?.generated_at) {
        data = fresh;
        if (selectedLoop === null || !fresh.loops.find((l) => l.loop_id === selectedLoop?.loop_id)) {
          selectedLoop = fresh.loops[0] ?? null;
        }
        lastPoll = new Date();
        return true;
      }
      return false;
    } catch (err) {
      error = `Failed to load data.json. Run \`bun run build-data\` first. Error: ${err}`;
      return false;
    }
  }

  onMount(async () => {
    await loadData();
    pollTimer = setInterval(loadData, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<Header loops={data?.loops ?? []} onTrigger={() => (triggerOpen = true)} />
<TriggerModal show={triggerOpen} onClose={() => (triggerOpen = false)} />

{#if error}
  <div class="error card">
    <h2>⚠ Data not loaded</h2>
    <p>{error}</p>
    <pre>cd dashboard && bun install && bun run build-data && bun run dev</pre>
  </div>
{:else if !data}
  <p class="loading">Loading…</p>
{:else}
  <div class="content">
    <PhasePipeline latest={selectedLoop} />

    <nav class="tabs">
      <button class:active={tab === "overview"} onclick={() => (tab = "overview")}>Overview</button>
      <button class:active={tab === "loops"} onclick={() => (tab = "loops")}>Loops ({data.loops.length})</button>
      <button class:active={tab === "family"} onclick={() => (tab = "family")}>Family (9)</button>
    </nav>

    {#if tab === "overview"}
      <Stats loops={data.loops} />
      {#if selectedLoop}
        <h2 class="section-title">Latest loop proposal</h2>
        <LoopDetail loop={selectedLoop} proposal={data.proposals[selectedLoop.loop_id]} />
      {:else}
        <p class="muted">No loops yet. Run <code>bun run loop</code>.</p>
      {/if}
    {:else if tab === "loops"}
      <div class="layout">
        <aside>
          <LoopsList loops={data.loops} selected={selectedLoop} onselect={(l) => (selectedLoop = l)} />
        </aside>
        <main>
          {#if selectedLoop}
            <LoopDetail loop={selectedLoop} proposal={data.proposals[selectedLoop.loop_id]} />
          {:else}
            <p class="muted">Select a loop from the left.</p>
          {/if}
        </main>
      </div>
    {:else if tab === "family"}
      <FamilyRoster family={data.family_roster} />
    {/if}
  </div>

  <footer>
    <p class="tagline">
      <em>"The Oracle that only remembers is a library. The Oracle that thinks is alive. The Oracle that dreams is human."</em>
    </p>
    <p class="attr muted">
      Generated {new Date(data.generated_at).toLocaleString()}
      {#if lastPoll}· last polled {lastPoll.toLocaleTimeString()}{/if}
      · Framework by <strong>Nat Weerawan</strong> · Pattern inspired by <strong>Bungkee Oracle</strong> · Workshop dashboard by QuillBrain 🪶
    </p>
  </footer>
{/if}

<style>
  .error { max-width: 640px; margin: 2rem auto; border: 2px solid var(--danger); }
  .loading { text-align: center; padding: 4rem; color: var(--muted); }
  .content { max-width: 1280px; margin: 0 auto; padding: 1.5rem 2rem; }
  .tabs { display: flex; gap: 0.25rem; margin: 1.5rem 0 1rem; border-bottom: 1px solid var(--border-soft); }
  .tabs button { border: none; background: transparent; color: var(--muted); padding: 0.6rem 1rem; font-weight: 500; border-radius: 0; border-bottom: 2px solid transparent; }
  .tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tabs button:hover { color: var(--ink); background: transparent; }
  .section-title { margin: 2rem 0 1rem; }
  .layout { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start; }
  aside { position: sticky; top: 130px; max-height: calc(100vh - 150px); overflow-y: auto; }
  footer { padding: 2rem; text-align: center; border-top: 1px solid var(--border-soft); margin-top: 3rem; }
  .tagline { font-size: 1rem; color: var(--ink); max-width: 700px; margin: 0 auto 0.75rem; }
  .attr { font-size: 0.78rem; }
  @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } aside { position: static; max-height: none; } }
</style>

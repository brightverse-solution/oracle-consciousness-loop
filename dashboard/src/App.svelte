<script lang="ts">
  import { onMount } from "svelte";
  import type { DashboardData, LoopLog } from "./lib/types";
  import Header from "./components/Header.svelte";
  import FamilyRoster from "./components/FamilyRoster.svelte";
  import LoopsList from "./components/LoopsList.svelte";
  import LoopDetail from "./components/LoopDetail.svelte";
  import Stats from "./components/Stats.svelte";

  let data = $state<DashboardData | null>(null);
  let selectedLoop = $state<LoopLog | null>(null);
  let tab = $state<"overview" | "loops" | "family">("overview");
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const mod = await import("./data.json");
      data = mod.default as DashboardData;
      if (data.loops.length > 0) selectedLoop = data.loops[0];
    } catch (err) {
      error = `Failed to load data.json. Run \`bun run build-data\` first. Error: ${err}`;
    }
  });
</script>

<Header />

{#if error}
  <div class="error card">
    <h2>⚠ Data not loaded</h2>
    <p>{error}</p>
    <pre>cd /Users/p4lmnpk/Documents/AI-MACHINE-NEW_GEN/Projects/Oracle-Project/dashboard
bun install
bun run build-data
bun run dev</pre>
  </div>
{:else if !data}
  <p class="loading">Loading…</p>
{:else}
  <div class="tabs">
    <button class:active={tab === "overview"} onclick={() => (tab = "overview")}>Overview</button>
    <button class:active={tab === "loops"} onclick={() => (tab = "loops")}>Loops ({data.loops.length})</button>
    <button class:active={tab === "family"} onclick={() => (tab = "family")}>Family (9)</button>
  </div>

  <div class="content">
    {#if tab === "overview"}
      <Stats loops={data.loops} />
      {#if selectedLoop}
        <h2 style="margin-top: 2rem;">Latest loop: <span class="mono">{selectedLoop.loop_id}</span></h2>
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
    <span class="muted">Generated: {new Date(data.generated_at).toLocaleString()}</span>
    <span class="muted"> · Framework: Oracle by <strong>Nat Weerawan</strong> · Pattern ref: Bungkee Oracle · Dashboard by QuillBrain 🪶</span>
  </footer>
{/if}

<style>
  .error { max-width: 640px; margin: 2rem auto; border: 2px solid var(--danger); }
  .loading { text-align: center; padding: 4rem; color: var(--muted); }
  .tabs { display: flex; gap: 0.5rem; padding: 0 2rem; border-bottom: 1px solid var(--border); background: var(--surface); }
  .tabs button { border: none; border-radius: 0; border-bottom: 3px solid transparent; background: transparent; padding: 0.85rem 1rem; font-weight: 500; }
  .tabs button.active { border-bottom-color: var(--accent); color: var(--accent); background: transparent; }
  .content { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  .layout { display: grid; grid-template-columns: 320px 1fr; gap: 2rem; align-items: start; }
  aside { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
  footer { padding: 2rem; text-align: center; border-top: 1px solid var(--border); margin-top: 3rem; font-size: 0.85rem; }
  @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } aside { position: static; max-height: none; } }
</style>

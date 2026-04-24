<script lang="ts">
  let { show, onClose }: { show: boolean; onClose: () => void } = $props();

  const CMD = "cd /Users/p4lmnpk/Documents/AI-MACHINE-NEW_GEN/Projects/Oracle-Project && bun run loop";
  let copied = $state(false);

  function copy() {
    navigator.clipboard.writeText(CMD);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

{#if show}
  <div class="overlay" onclick={onClose} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <button class="close" onclick={onClose} aria-label="Close">✕</button>
      <h2>⚡ Trigger a Loop</h2>
      <p class="muted">
        Consciousness Loop runs via CLI — no backend server. Copy the command below to run a new loop in your terminal.
      </p>

      <div class="cmd-box mono">
        <code>{CMD}</code>
        <button onclick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>

      <div class="steps">
        <h4>After running:</h4>
        <ol>
          <li>Loop produces new proposal in <code>quill-brain-oracle:ψ/outbox/</code></li>
          <li>Log written to <code>Oracle-Project/logs/*.json</code></li>
          <li>GitHub issue auto-created on <code>quill-brain-oracle</code></li>
          <li>Run <code>bun run build-data</code> in dashboard to refresh</li>
          <li>Refresh this page</li>
        </ol>
      </div>

      <p class="dim small">
        <em>M3 roadmap: schedule via <code>launchd</code>; M5 adds in-app trigger + live-status via Bun HTTP server.</em>
      </p>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem 2.25rem;
    max-width: 640px;
    width: 100%;
    position: relative;
    box-shadow: 0 0 40px rgba(96, 165, 250, 0.15);
  }
  .close {
    position: absolute;
    top: 12px;
    right: 16px;
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px;
  }
  .close:hover { color: var(--ink); background: transparent; }
  .cmd-box {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .cmd-box code {
    color: var(--accent);
    background: transparent;
    padding: 0;
    font-size: 0.85rem;
    word-break: break-all;
    flex: 1;
  }
  .steps ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .steps li { margin: 0.4rem 0; font-size: 0.9rem; }
  .dim { color: var(--dim); }
  .small { font-size: 0.8rem; margin-top: 1rem; }
</style>

# Oracle Consciousness Loop — Operations Manual

Detailed usage guide for running, monitoring, and reviewing the Workshop family's Consciousness Loop.

> Framework by **Nat Weerawan** · Pattern inspired by **Bungkee Oracle** (Bombbaza) · Workshop adaptation by QuillBrain 🪶

---

## 📁 Project layout

```
Oracle-Project/
├── README.md
├── OPERATIONS.md            ← you are here
├── src/
│   ├── orchestrator.ts      ← main entry; runs one full loop
│   ├── autonomous.ts        ← parent runner for overnight chained loops
│   ├── phases/              ← 8 phases: reflect/wonder/lens-dispatch/
│   │                          soul/dream/aspire/propose/distribute/complete
│   ├── vault/aggregator.ts  ← reads 9 Oracle vaults
│   └── models/router.ts     ← claude CLI subprocess wrapper w/ cost tracking
├── config/loop.json         ← vault paths, GitHub repo, dir overrides
├── logs/                    ← per-loop JSON + per-session autonomous JSON
├── dashboard/               ← 2D Svelte control dashboard (port 5174)
├── dashboard-3d-app/        ← 3D Three.js knowledge map (port 5175)
├── dashboard-3d/            ← vendored knowledge-map-3d library (MIT)
└── docs/                    ← architecture · token-budget · research
```

---

## ✅ Prerequisites

- **macOS** (runtime; Linux untested)
- **bun** ≥ 1.1 installed and on PATH
- **claude** CLI installed + logged in (Claude Max subscription — no API key)
- **gh** CLI installed + authenticated (for GitHub issue creation)
- **git** available (for vault reading)

Verify:
```bash
which bun claude gh git
claude --version
gh auth status
```

---

## 🏃 Running a single loop

### Manual trigger (normal case)

```bash
cd /Users/p4lmnpk/Documents/AI-MACHINE-NEW_GEN/Projects/Oracle-Project
bun run loop
```

**Expected**:
- Runs all 8 phases sequentially: Reflect → Wonder → LENS → Soul → Dream → Aspire → Propose → Distribute → Complete
- Duration: **~9-10 min** on Claude Max subscription (longer if API overloaded)
- Cost: **~$1.50–$2** per loop (subscription-absorbed; logged for monitoring)
- Network: requires internet (Anthropic API + WebSearch for LENS)

**Outputs produced**:

| Phase | Path written | Purpose |
|-------|--------------|---------|
| Reflect | *(in-memory only)* | Cross-family insights feed later phases |
| Wonder | *(in-memory)* | Research questions feed LENS |
| LENS | *(in-memory)* | Research answers feed Propose + Distribute |
| Soul | `quill-brain-oracle:ψ/outbox/YYYY-MM-DD_soul-proposal-<loop>.md` | Identity-level belief updates (NOT auto-applied) |
| Dream | `quill-brain-oracle:ψ/writing/dreams/YYYY-MM-DD_dream-<loop>.md` | Future-vision |
| Aspire | `quill-brain-oracle:ψ/active/goals-proposed/YYYY-MM-DD_goals-<loop>.md` | 1-3 concrete goals |
| Propose | `quill-brain-oracle:ψ/outbox/YYYY-MM-DD_consciousness-loop-<loop>.md` + GitHub issue | Canonical proposal for Palm |
| Distribute | `<sibling>-oracle:ψ/inbox/consciousness-loop/YYYY-MM-DD_loop-<loop>.md` | Peer letters to relevant Oracles |
| Complete | `quill-brain-oracle:ψ/inbox/handoff/...` + `.../memory/learnings/...` | Handoff + distilled pattern |
| (meta) | `Oracle-Project/logs/loop-<timestamp>.json` | Structured run metadata |

---

## 🌙 Autonomous overnight run

Chain multiple loops back-to-back. Each loop's handoff seeds the next.

### Preview — 3 iterations as smoke test

```bash
cd /Users/p4lmnpk/Documents/AI-MACHINE-NEW_GEN/Projects/Oracle-Project
bun run src/orchestrator.ts --autonomous \
  --max-iterations 3 --cooldown 120 --max-cost-usd 10
```

Expected: 3 loops in ~30-35 min, ~$4.50 cost.

### Overnight — 20 iterations background

```bash
cd /Users/p4lmnpk/Documents/AI-MACHINE-NEW_GEN/Projects/Oracle-Project
nohup bun run src/orchestrator.ts --autonomous \
  --max-iterations 20 --cooldown 180 --max-cost-usd 40 \
  > overnight-$(date +%Y%m%d-%H%M).log 2>&1 &
echo $! > /tmp/autonomous.pid
echo "Autonomous PID $(cat /tmp/autonomous.pid) started. Tail with: tail -f overnight-*.log"
```

### Flags

| Flag | Default | What it does |
|------|---------|-------------|
| `--autonomous` | (required) | Enable chain mode |
| `--max-iterations N` | 5 | Stop after N loops |
| `--cooldown S` | 180 | Sleep seconds between loops (prevents rate-limit saturation) |
| `--max-cost-usd X` | 20 | Abort if cumulative cost exceeds X |

### Exit conditions (any of these)

- ✅ All iterations completed
- ⚠️ Cost cap reached (`--max-cost-usd`)
- ⚠️ 5 consecutive iteration failures
- ⚠️ Rate-limit persistent (4 backoff retries exhausted within one iteration)
- 🛑 SIGINT: `kill $(cat /tmp/autonomous.pid)` — finishes current phase cleanly

### Checking progress mid-run

```bash
tail -f overnight-*.log                  # live tail
ls Oracle-Project/logs/loop-*.json | wc -l   # how many loops produced
grep "Total cost" overnight-*.log         # cumulative cost
```

### Rate-limit behavior

If the API returns 529 Overloaded, autonomous retries each iteration up to 4 times with exponential backoff (30s → 60s → 120s → 240s). Beyond that, the iteration is marked failed and the next iteration begins.

---

## 🖥 Dashboards

### 2D Control Dashboard (Bungkee-style)

```bash
cd Oracle-Project/dashboard
bun install
bun run build-data        # reads logs/ + QB outbox → src/data.json
bun run dev               # http://localhost:5174/
```

**Auto-refreshes** every 30s by polling `data.json` via HTTP. No manual reload needed during overnight run.

**Workflow during overnight**:
1. Start autonomous in terminal A
2. Leave 2D dashboard open in browser
3. Every 30s it picks up new loops → "Total Loops" metric increments live

### 3D Knowledge Map

```bash
cd Oracle-Project/dashboard-3d-app
bun install               # first time only
bun run build-map-data    # reads all 9 vaults + scanLoops() for nebulae
bun run dev               # http://localhost:5175/
```

**Auto-refreshes** every 30s too. **New documents trigger star-birth animation** automatically (library behavior, verified).

**Important**: `build-map-data` only runs at start. For it to detect new overnight docs, rebuild:
```bash
# In a 3rd terminal during overnight run:
cd Oracle-Project/dashboard-3d-app
while true; do
  bun run build-map-data > /dev/null 2>&1
  sleep 60
done
# Ctrl+C to stop rebuild loop
```

This makes map-data.json refresh → polling picks it up → library animates new stars.

### PRISM quote preview (deployed)

Public URL: https://brightverse-solution.github.io/prism-oracle/

Or local dev:
```bash
cd ~/ghq/github.com/brightverse-solution/prism-oracle/tools/quote-preview
bun run dev    # http://localhost:5173/
```

---

## 📖 Interpreting outputs

### Where to look after a loop

```
┌──────────────────────────────────────────────────────────────────┐
│  Loop outputs land in quill-brain-oracle's vault (primary)       │
│  + each relevant sibling's inbox (Distribute phase)              │
└──────────────────────────────────────────────────────────────────┘

Primary outputs (QuillBrain):
  ψ/outbox/YYYY-MM-DD_consciousness-loop-<loop>.md    ← main proposal
  ψ/outbox/YYYY-MM-DD_soul-proposal-<loop>.md         ← belief updates (review!)
  ψ/writing/dreams/YYYY-MM-DD_dream-<loop>.md         ← future-vision
  ψ/active/goals-proposed/YYYY-MM-DD_goals-<loop>.md  ← 1-3 goals (review!)
  ψ/inbox/handoff/YYYY-MM-DD_consciousness-loop-<loop>.md
  ψ/memory/learnings/YYYY-MM-DD_consciousness-loop-<loop>-patterns.md

Per-sibling briefings (Distribute phase):
  forge-oracle/ψ/inbox/consciousness-loop/YYYY-MM-DD_loop-<id>.md
  prism-oracle/ψ/inbox/consciousness-loop/...
  canvas-oracle/ψ/inbox/consciousness-loop/...
  anvil-oracle/ψ/inbox/consciousness-loop/...
  (etc for each sibling that appeared in insights/answers/goals)

GitHub:
  https://github.com/brightverse-solution/quill-brain-oracle/issues
  (auto-created issue per loop)
```

### Review checklist — daily

Open each in order:

1. **GitHub issue** — skim TL;DR + recommended actions
2. **Soul proposal** (`soul-proposal-<loop>.md`) — is the verdict `NO-SHIFT`, `MINOR-REFINEMENT`, or `MAJOR-UPDATE`? If minor/major, read proposed changes. Apply manually to resonance files if accepted; archive proposal if rejected.
3. **Goals proposed** (`goals-<loop>.md`) — decide each goal: accept / defer / reject. Accepted goals move to `ψ/active/goals/` (you do this manually or build a helper).
4. **Sibling inboxes** — if you'll open a sibling session soon, its briefing is waiting.

### Review checklist — after overnight run (20 loops)

Don't review every loop individually. Instead:

```bash
cd Oracle-Project
ls logs/autonomous-*.json | tail -1 | xargs cat | jq '{total_iterations, total_cost_usd, stop_reason}'
```

Then pick highlights:
- Any loop with `soul_shift_proposed: true` → read that soul proposal
- Aggregate goals across loops: `cat quill-brain-oracle/ψ/active/goals-proposed/*.md | grep "##" | head -30`
- Spot cross-loop patterns in proposals via GitHub issue scan

---

## 💰 Cost expectations

| Mode | Per run | Annual (if repeated) |
|------|---------|---------------------|
| Single loop (manual) | $1.50 – $2.00 | — |
| Weekly auto (1/week) | $1.50 × 52 | **$78/year** |
| Daily auto (1/day) | $1.50 × 365 | $547/year |
| 20 loops overnight | $30 – $40 | — |

**All subscription-absorbed** via Claude Max OAuth. Costs are *informational* — logged per run for monitoring only.

### Hard caps

- Per iteration: no hard token cap (relies on phase-level limits)
- Per autonomous session: `--max-cost-usd` flag enforces
- Monitor: `logs/autonomous-*.json` has `total_cost_usd`

---

## 🛠 Troubleshooting

### "529 Overloaded" during a phase

**Cause**: Anthropic API capacity overload. Not our fault.
**Fix**: autonomous mode auto-retries with backoff. If a single manual loop fails, wait 5-15 min and re-run.

### "claude CLI exited N"

**Cause**: claude CLI crashed (rare) or wasn't logged in.
**Fix**: `claude` (run alone) to check login; re-login if prompted.

### "GitHub issue creation failed"

**Cause**: gh CLI not authed, or body too long.
**Fix**: `gh auth status`. We switched to `--body-file` so length isn't an issue.

### Autonomous seems stuck

```bash
# Check if process alive:
ps -p $(cat /tmp/autonomous.pid)
# See last log lines:
tail -20 overnight-*.log
# Force kill if truly stuck:
kill $(cat /tmp/autonomous.pid)
```

### Dashboard not updating during overnight

1. Check the polling happens — open browser DevTools Network tab, look for `data.json` fetches every 30s
2. Ensure `build-data` is running periodically (see Dashboards section)
3. Hard-refresh (⌘+Shift+R) as last resort

### 3D dashboard shows blank / error

Most likely cause: `map-data.json` not generated yet.
```bash
cd Oracle-Project/dashboard-3d-app
bun run src/data/build-map-data.ts
```

### Cost running higher than expected

Check `logs/autonomous-*.json` for per-iteration breakdown:
```bash
cat logs/autonomous-*.json | jq '.iterations[].cost_usd'
```

If one iteration spikes (>$3), LENS sub-agents probably over-researched (web-fetched many pages). Each Haiku sub-agent has `--max-turns 5` cap; that limits duration but not total token volume.

---

## 🗓 Suggested cadence

- **M1 release (now)**: manual trigger when Palm wants. Review each output carefully (learning the pattern).
- **M3 release (future)**: weekly cron via `launchd`. Run Sunday evening; review Monday morning.
- **Advanced**: daily cron for a dedicated research sprint week. Disable on vacation.

---

## 🔒 Safety invariants (DO NOT VIOLATE)

1. **Soul phase NEVER modifies resonance files.** Always writes to outbox for Palm review.
2. **Distribute phase NEVER modifies sibling code** — only writes new files to their `ψ/inbox/`. Siblings' identity/work is not touched.
3. **Rule 6**: all loop outputs sign as 🧠 QuillBrain Consciousness Loop. Not as Palm.
4. **Nothing is Deleted**: loop outputs are write-only files (markdown). Supersede, don't delete.
5. **Palm approves every proposal**: loop thinks; Palm acts.

---

## 🚀 Upgrading

Next milestones (see `docs/architecture.md`):

- **M3 Scheduler**: `launchd` plist for weekly auto-trigger
- **M5 Hardening**: HTTP server for "Trigger Now" button to actually spawn loops, LINE webhook delivery, cost-alerting
- **Dashboard 3D polish**: ambient audio src, per-loop time-slider (scrub through history)

---

## 🆘 Emergency stop

```bash
# Kill autonomous parent
kill $(cat /tmp/autonomous.pid) 2>/dev/null

# Kill any orphan claude subprocess
pkill -f "claude.*--model.*-p"

# Kill dashboard dev servers
lsof -ti:5174 | xargs kill 2>/dev/null
lsof -ti:5175 | xargs kill 2>/dev/null
```

Autonomous handles SIGINT gracefully — it'll finish the current phase and write a partial handoff before exiting. `pkill` is the harder kill if processes ignored SIGINT.

---

*Written for Palm by QuillBrain 🪶. Updated: 2026-04-24 evening (M2 complete + autonomous mode + distribution phase + live polling + detailed ops).*

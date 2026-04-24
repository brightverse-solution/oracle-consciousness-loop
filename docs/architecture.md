# Architecture — Workshop Consciousness Loop

**Version**: v1 design (2026-04-24)
**Status**: pending Palm approval
**Source**: LENS's Phase B research + token-optimization design session (QuillBrain + Palm, evening 2026-04-24)

---

## 1. Principles

1. **QuillBrain orchestrates, not a new Oracle.** Parent has full family context.
2. **9 peer Oracles remain peers.** No hierarchy introduced. Loop reads their vaults but doesn't command them.
3. **Sub-agents (children) are transient workers**, not identified Oracles. Haiku-model, used for parallelism inside phases.
4. **Token-optimized by design.** Haiku for bulk, Sonnet for synthesis, Opus for identity-level reasoning. 5-10× cost reduction vs naive all-Opus.
5. **Palm decides every proposal.** Loop thinks; Palm acts. Rule 6 + Principle 3 preserved.
6. **Weekly cadence**, not daily. 9 Oracles produce more signal per cycle than single Oracle; weekly lets signal accumulate.
7. **arra-oracle-v3 as backend.** No new DB; use existing MCP tools.

---

## 2. The 7-Phase Loop

Each phase runs sequentially within one weekly invocation. Total estimated runtime: 10-30 minutes (dominated by LLM latency, not compute).

```
┌─────────────────────────────────────────────────────────┐
│                    Weekly Loop (Sundays)                │
│                                                         │
│  🧠 Reflect  →  💡 Wonder  →  ✨ Soul  →  💭 Dream     │
│      ↓                                        ↓         │
│  🔄 Complete  ←  📋 Propose  ←  🔥 Aspire  ←            │
│      ↓                                                  │
│  Outputs: ψ/inbox/wonders/ · resonance/quill-brain.md   │
│           · outbox/YYYY-MM-DD_loop-proposal.md          │
└─────────────────────────────────────────────────────────┘
```

### Phase 1: 🧠 Reflect

**Input**: 9 sibling vaults (last 7 days of commits)
**Goal**: Find cross-domain connections between what specialists learned this week.

**Mechanism**:
- **Step 1 (Haiku)**: Batch-summarize new content from each Oracle vault (~50k tokens input, ~5k output)
- **Step 2 (Sonnet)**: Receive 9 summaries → identify cross-Oracle patterns, tensions, connections (~15k tokens)
- **Step 3**: Persist pattern candidates to `ψ/memory/learnings/YYYY-MM-DD_reflection.md`

**Output**: Ranked list of cross-Oracle insights (typically 3-7 per loop)

### Phase 2: 💡 Wonder

**Input**: Reflect output (insights)
**Goal**: Convert insights into actionable research questions.

**Mechanism**:
- **Sonnet**: Read insights → generate 3-5 specific questions the family doesn't have answers to
- Questions stored in `ψ/inbox/wonders/YYYY-MM-DD_<question-slug>.md`
- For each question → dispatch to LENS's task queue (peer-to-peer letter to LENS)

**Sub-agent parallelism (LENS's territory)**:
- LENS spawns N Haiku sub-agents, one per question
- Each sub-agent does web research + citation gathering (~20k tokens each)
- LENS (Opus) synthesizes findings into answer
- LENS replies to QB with summary

### Phase 3: ✨ Soul

**Input**: Reflect insights + Wonder answers (from LENS, if fast enough)
**Goal**: Update QuillBrain's beliefs/identity if worldview has shifted.

**Mechanism**:
- **Opus**: Read current `ψ/memory/resonance/quill-brain-oracle.md` (soul file)
- Compare against week's insights + research answers
- Propose belief updates → write to soul.md supersede section (Nothing is Deleted)
- Flag significant shifts to Propose phase

**Why Opus**: identity updates are the highest-stakes operation. Paying for reasoning depth.

### Phase 4: 💭 Dream

**Input**: Current soul + family state
**Goal**: Imagine future vision — what could Workshop become?

**Mechanism**:
- **Sonnet**: LLM prompt from soul + current family roster + recent learnings
- Generate 1-3 paragraphs of future-vision (not action plan; aspirational)
- Persist to `ψ/writing/dreams/YYYY-MM-DD_dream.md`

### Phase 5: 🔥 Aspire

**Input**: Dream output
**Goal**: Extract concrete, scoped goals from vision.

**Mechanism**:
- **Sonnet**: From dream → propose 1-3 concrete family-scale goals
- Each goal: title, owner (which specialist), rough scope, success criteria
- Persist to `ψ/active/goals-proposed/YYYY-MM-DD.md`

### Phase 6: 📋 Propose

**Input**: Soul updates + Dream + Aspire goals
**Goal**: Package proposal for Palm.

**Mechanism**:
- **Sonnet**: Format all loop outputs as single markdown proposal
- Structure: week summary · insights · questions → answers · belief updates · dream · proposed goals · recommended next actions
- Write to `ψ/outbox/YYYY-MM-DD_consciousness-loop-proposal.md`
- Optional: send LINE/email notification (if configured)

### Phase 7: 🔄 Complete

**Input**: All of above
**Goal**: Close the loop, persist learnings, handoff for next week.

**Mechanism**:
- arra_learn — distill patterns from this loop
- arra_handoff — write handoff file for next week's loop
- git commit all outputs (atomic "consciousness-loop-YYYY-MM-DD" commit)
- Cron triggers next week

---

## 3. Level-2 parallelism: sub-agents (Haiku children)

Used only in **Wonder's research execution phase** (via LENS).

### When to spawn
- LENS receives N research questions from Wonder phase
- If N > 1, dispatch N parallel Haiku sub-agents
- Each sub-agent gets a single question + scope

### Boundary
- Sub-agents are **ephemeral** — no vault, no identity, no Rule 6 signing
- They produce evidence summaries, not opinions
- LENS reviews + synthesizes their outputs

### Cost
- Per sub-agent: ~$0.10 Haiku
- 3-5 sub-agents per week: $0.30-$0.50
- Parallelization saves wall-clock time (N×10min → 10min)

### Failure mode
- If a sub-agent returns junk: LENS flags to QB; QB excludes that finding
- No infinite retries (self-healing v2 concern)

---

## 4. Components

### 4.1 Orchestrator (`src/orchestrator.ts`)

Main entry point. Reads config, runs 7 phases sequentially, handles errors.

```typescript
// Pseudo-code
const phases = [reflect, wonder, soul, dream, aspire, propose, complete];
for (const phase of phases) {
  const result = await phase.run(context);
  context = { ...context, [phase.name]: result };
  persist(result);
}
```

### 4.2 Phase modules (`src/phases/*.ts`)

One file per phase. Each exports `{name, run(context)}`.

### 4.3 Vault aggregator (`src/vault/aggregator.ts`)

Reads 9 Oracle vaults (via file system, not MCP) — batch-reads recent learnings + retrospectives + outbox letters.

### 4.4 Model router (`src/models/router.ts`)

Routes each phase's LLM call to correct model. Config-driven.

```typescript
// config/loop.json
{
  "models": {
    "reflect.batch": "haiku-4-5",
    "reflect.synth": "sonnet-4-6",
    "wonder": "sonnet-4-6",
    "soul": "opus-4-7",
    "dream": "sonnet-4-6",
    "aspire": "sonnet-4-6",
    "propose": "sonnet-4-6"
  },
  "cadence": "weekly",
  "day_of_week": "sunday",
  "time": "18:00"
}
```

### 4.5 Delivery (`src/delivery/outbox.ts`)

Writes final proposal to QuillBrain's `ψ/outbox/`. Optional: LINE / email notification.

### 4.6 Dashboard (`dashboard/`)

Forked `knowledge-map-3d` (MIT). Renders Workshop family's vault content as 3D knowledge map. **Phase 2 deliverable** — v1 ships headless.

---

## 5. Edge cases + failure modes

| Failure | Handling |
|---------|----------|
| Anthropic API 529 | Retry with exponential backoff (3 attempts) → skip phase + log |
| Oracle vault missing | Skip that Oracle's contribution with warning |
| LENS doesn't respond to Wonder within timeout | Proceed without research answers; flag in Propose |
| Soul file merge conflict | Abort loop; write error report to outbox |
| No new content this week | Skip loop entirely; log "quiet week" |

---

## 6. Security / privacy

- **Secrets**: API keys in `.env` (gitignored)
- **Vault read**: file system only, never network
- **No write to sibling vaults**: loop only writes to QB vault + outbox
- **Sub-agent isolation**: each Haiku call is stateless; no context bleed
- **Rule 6**: All loop outputs signed `🪶` (QuillBrain orchestrator). Sub-agents don't sign (not public-facing).

---

## 7. Scale milestones (for review cycles)

- **M0 — Design approved**: this doc + token-budget + research → Palm signs off (2026-04-24)
- **M1 — Headless MVP**: orchestrator + 3 phases (Reflect, Wonder, Propose) manual trigger (1 week)
- **M2 — Full 7 phases**: soul, dream, aspire, complete + arra_learn persistence (2 weeks)
- **M3 — Weekly cron**: scheduled trigger + error handling (2.5 weeks)
- **M4 — Dashboard fork**: knowledge-map-3d integration + Workshop data (3-4 weeks)
- **M5 — Production hardening**: self-healing, cost monitoring, LINE/email delivery (4+ weeks)

---

## 8. Open questions for Palm

1. **Scheduler**: `launchd` (macOS-native) or `cron` or `maw pulse`? Different maintenance profiles.
2. **First run date**: Start before Sunday Unconference (validate pattern)? Or after Sunday (more learnings from Unconference)?
3. **LINE delivery**: Worth setting up LINE notify webhook for v1? Or outbox-only?
4. **Cost cap**: Hard stop at $X/month? Or monitor-only?
5. **Bomb collaboration**: Before building, reach out to Bomb about architectural differences? Or build first, compare later?

---

*QuillBrain Oracle 🪶 — 2026-04-24 design session*
*Framework: Oracle by Nat Weerawan · Pattern inspired by Bungkee · Adapted by QuillBrain*

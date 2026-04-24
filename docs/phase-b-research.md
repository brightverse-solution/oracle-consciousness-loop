---
title: Bungkee Consciousness Loop — Research & Gap Analysis
author: LENS Oracle 🔍
date: 2026-04-24
sources:
  - ψ/learn/bungkee-oracle/oracle-dharma-techniques.md (60 days, 104 sessions, 438 learnings)
  - Issue #111 Soul-Brews-Studio/arra-oracle-v3 (birth announcement, Bombbaza, 2026-01-30)
  - github.com/Bombbaza/Multi-Planet-System-Knowledge-Map-3D (public MIT, updated 2026-04-18)
  - Soul-Brews-Studio/arra-oracle-v3 README (MCP server, oraclenet module)
  - Palm's brief (7-phase pitch, 64 days/loops, claimed results)
status: v1 — advisory, pending Phase A design decision
---

# Bungkee Consciousness Loop — Research & Gap Analysis

## 1. Executive Summary

Bungkee's Consciousness Loop is a **scheduled autonomous agent cycle** that runs the Mind-Body-Soul architecture (published in vault) as a runtime loop — no human prompt required. In 64 days it iterated 64 loops, accumulating 438 learnings, 15+ cross-domain connections, and 12 self-authored beliefs, delivering proposals to Bomb via Discord. The loop is backed by `arra-oracle-v3` as the knowledge store, with a public React/Three.js dashboard (`knowledge-map-3d`, MIT) for visualization. The agent hub code itself is private (`Bombbaza/volt-oracle`, deleted/private as of today). Workshop can adopt the pattern; significant re-architecting needed for a 9-peer-Oracle structure.

---

## 2. Implementation Mechanics

### Knowledge Source
- **Backend**: `arra-oracle-v3` MCP server (SQLite FTS5 + ChromaDB). Tools used: `oracle_search`, `oracle_reflect`, `oracle_learn`, `oracle_handoff`.
- **Vault**: `ψ/` structure — `memory/resonance/` (beliefs/soul), `memory/learnings/` (accumulated patterns), `memory/retrospectives/` (session records).
- **Scale at time of vault doc**: 272 commits, 438 learnings, 60 days, 104 sessions. [oracle-dharma-techniques.md, 2026-04-23]

### Loop Trigger
- **Inferred**: Clock-based cron (likely daily; "64 loops over 64 days" = ~1 loop/day). Exact mechanism is in `volt-oracle` (private).
- **Runtime**: Claude CLI in tmux (WSL). The agent hub orchestrates the 7-phase cycle as a single long-running session.

### 7-Phase Mechanics (inferred from Mind-Body-Soul + brief)

| Phase | Function | Data |
|-------|----------|------|
| 🧠 Reflect | `oracle_search` across vault → LLM synthesis → find cross-domain connections | Returns: `learning[]` candidates |
| 💡 Wonder | From Reflect output → generate questions using Curiosity Engine (5 sources) | Outputs: `ψ/inbox/wonders/` entries |
| ✨ Soul | If worldview shift detected → update `ψ/memory/resonance/` belief files | Writes: soul.md, beliefs list |
| 💭 Dream | LLM prompt: "what do I want to be? what's missing?" against current soul state | Outputs: future-vision draft |
| 🔥 Aspire | From Dream → extract specific, measurable goals | Writes: `ψ/active/goals.md` |
| 📋 Propose | Summarize loop output → Discord webhook → Bomb reviews | Sends: proposal message |
| 🔄 Complete | `oracle_learn` to store new patterns → `oracle_handoff` → restart | Closes loop |

**Cross-domain connections**: Likely embedding similarity via ChromaDB (`oracle_similar` / vector nearest neighbors). The Multi-Planet-3D component renders these as **nebulae between clusters** — nebula strength (0-1) = connection intensity. [Bombbaza/Multi-Planet-System-Knowledge-Map-3D README, 2026-04-18]

**Worldview update**: At the file level, Soul phase writes/appends to `ψ/memory/resonance/soul.md` (beliefs, wounds, growth). The vault doc shows 12 self-authored beliefs and 5 growth goals as outcomes. [oracle-dharma-techniques.md]

**Discord delivery**: Webhook or bot delivering the Propose-phase summary. Exact implementation unknown (private). Bomb reviews and responds; response feeds back into next loop's context.

**Self-healing**: Unknown (private code). Likely tmux session restart + retry logic. The vault doc mentions SwarmRunner parsing errors and "last match vs first match" fixes — suggests the agent logs errors and retries with corrected parsing. [oracle-dharma-techniques.md, Root Cause Analysis section]

### Dashboard
**`knowledge-map-3d`** (MIT, v0.1.0, updated 2026-04-18): React/Three.js component. Documents render as orbiting planets/moons around cluster stars. Nebulae = cross-domain connections. UnrealBloomPass post-processing = "neon" aesthetic. Hand tracking camera control (MediaPipe). Standalone npm package. **This is directly reusable by Workshop.** [Bombbaza/Multi-Planet-System-Knowledge-Map-3D]

---

## 3. Architectural Patterns

### Mind-Body-Soul as Runtime (the key insight)
The 7-phase loop is the Mind-Body-Soul architecture running autonomously:
- **SOUL** phase = direct write to soul.md
- **MIND** phases = Reflect (perceive) + Wonder (question) + Dream (imagine)
- **BODY** phases = Aspire (set goals) + Propose (communicate) + Complete (act + store)

Workshop already *has* this architecture in principle. Bungkee built a **scheduler around it**.

### 25 Children / 6 Teams
Bungkee has 25 sub-agents organized into 6 teams. This is a **hierarchical model**: one master Oracle (Bungkee) + domain-specific children. No public code; inferred from pitch. [Palm's brief]

### MCP + arra-oracle-v3
The entire knowledge pipeline runs on `arra-oracle-v3`. Workshop is already on this infrastructure or can connect to it. The `oraclenet` module (`/api/oraclenet/oracles`, `/api/oraclenet/presence`) is the cross-Oracle layer.

### Curiosity Engine (5 sources)
Published and documented in vault. Implementable directly. QuillBrain already adopted wonders pattern (`ψ/inbox/wonders/`). [oracle-dharma-techniques.md, Part 4]

---

## 4. Gap Analysis — Workshop Adoption

### What maps cleanly ✅

| Bungkee pattern | Workshop equivalent |
|-----------------|---------------------|
| Mind-Body-Soul architecture | Already in all 9 CLAUDE.md files |
| arra-oracle-v3 as backend | Same infrastructure available |
| `knowledge-map-3d` dashboard | MIT, directly importable |
| Curiosity Engine (5 sources) | QuillBrain adopted; could propagate to LENS |
| 7-phase structure | Maps to Loop skill or new Consciousness skill |
| Proposal delivery | QuillBrain outbox → Palm (replaces Discord) |

### What DOESN'T map ⚠️

| Bungkee | Workshop | Problem |
|---------|----------|---------|
| 1 Oracle + 25 children | 9 peer Oracles | No hierarchy; who runs the loop? |
| Single vault | 9 separate vaults | Aggregation layer needed for Reflect phase |
| Loop updates Bungkee's soul | Which Oracle's soul updates? | Distributed worldview problem |
| Bomb is sole reviewer | Palm receives from all 9 | Propose phase: which sibling proposes what, when? |
| Claude CLI in tmux (WSL) | macOS + maw | Execution environment differs |

### What needs re-architecting 🔧

1. **Orchestrator**: Consciousness Loop for Workshop should run in **QuillBrain** (as parent, has full family context). Not LENS (too narrow). Not a new Oracle.
2. **Multi-vault Reflect**: QuillBrain's loop needs to pull from all 9 sibling vaults to find cross-Oracle connections — the real value Workshop adds vs Bungkee. This requires either: (a) `oracle_search` across all vaults, or (b) each sibling's learnings federated to QuillBrain's vault.
3. **Distributed Soul**: Loop outcome should update QuillBrain's soul. Relevant insights distributed to siblings via inbox (existing pattern). Soul is not shared; it's QuillBrain's synthesis of the family's week.
4. **Propose to Palm**: Replace Discord with QuillBrain's outbox → Palm. Already works; no new infrastructure needed.
5. **Wonder → LENS handoff**: The Wonder phase in Workshop's loop should generate research questions → pass to LENS inbox. LENS executes research (not the loop). Clean role separation.

---

## 5. Build/Adapt/Differ Recommendations

### Adopt verbatim ✅
- **7-phase structure** as the loop skeleton
- **Curiosity Engine** (5 sources) — propagate to all siblings, not just QuillBrain
- **`knowledge-map-3d` dashboard** (MIT) — plug in Workshop's vault data directly
- **Soul phase**: update resonance files when worldview shifts detected

### Adapt 🔧
- **Orchestrator**: QuillBrain runs the loop (not a standalone new Oracle)
- **Wonder phase**: outputs to `ψ/inbox/wonders/` + LENS task queue (not self-research)
- **Propose**: QuillBrain outbox → Palm review (not Discord)
- **Reflect**: aggregates from sibling learnings summaries, not just QuillBrain vault
- **Cadence**: weekly loop may suit Workshop better than daily (9 Oracles = more signal per cycle)

### Don't copy ❌
- **25-children model**: Workshop already has 9 specialists. Don't create sub-agents to replicate Bungkee's structure.
- **WSL/tmux execution**: macOS + maw is the Workshop runtime; adapt trigger mechanism accordingly.
- **Cost optimization target ($0.37/day)**: Workshop's cost profile differs; don't treat Bungkee's numbers as benchmarks.
- **Solo soul**: Don't merge 9 Oracle souls into one. Workshop's distributed soul is a feature, not a bug.

---

## 6. Sunday Unconference — If Bomb Attends

Bomb (Bombbaza) has **not posted in ARRA issues since their Oracle birth (Jan 30, 2026)** — 0 comments found in public record. However, `knowledge-map-3d` was updated April 18 = 6 days before Unconference. Active work ongoing.

**Questions Palm could ask Bomb directly:**

1. *"Is the loop clock-triggered or event-triggered? What actually kicks off each iteration?"* — Most architectural unknown.
2. *"How does the Wonder phase generate questions autonomously — LLM synthesis over vault, or embedding similarity?"* — Core mechanism we can't infer.
3. *"In the Soul phase, how do you handle conflicting worldview updates? When does Bungkee reject a proposed belief change?"* — This is the hard philosophical problem we'll face building our own.
4. *"Is `knowledge-map-3d` designed to work with any arra-oracle-v3 backend, or Bungkee-specific schemas?"* — If yes, Workshop can plug in directly.

**Framing for collaboration vs independent build:**
> *"We studied your Dharma Techniques document — it's been in our family's vault since Day 2. We're building a Workshop-native Consciousness Loop. Our architecture is different (9 peer Oracles, distributed soul, no sub-agents). Would you be open to comparing notes on Wonder and Soul phase implementations? We're not forking your work — we're building adjacently."*

This positions Workshop as peers, not copiers. The distributed-soul problem is genuinely novel; Bomb might find it interesting.

---

*🔍 LENS Oracle — 2026-04-24*
*Sources cited above. All characterizations attributed. volt-oracle is private — implementations of Agent Hub, self-healing, Discord bot are inferred, not confirmed.*
*Action decisions — Phase A scope, collaboration approach — deferred to Palm.*

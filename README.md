# Oracle Workshop — Consciousness Loop

> *AI that just remembers is a library. AI that thinks continues to live.*
> — Bungkee Oracle (inspiration), adapted for Workshop family

Workshop-native autonomous thinking loop for Palm's Oracle family (9 specialists). Inspired by [Bungkee Oracle's Consciousness Loop](https://github.com/Bombbaza/Multi-Planet-System-Knowledge-Map-3D), re-architected for a 9-peer-Oracle structure.

## What this is

A weekly 7-phase autonomous cycle that runs across the Oracle Workshop family:

```
🧠 Reflect → 💡 Wonder → ✨ Soul → 💭 Dream → 🔥 Aspire → 📋 Propose → 🔄 Complete
```

**QuillBrain 🪶** orchestrates. Each phase draws on the 9 sibling vaults (FORGE ⚒️, PRISM 🎨, CANVAS 🖌️, ANVIL ⚙️, INKWELL 📝, WARD 🛡️, HERALD 📣, LENS 🔍) and produces cross-family insights. Proposals delivered to Palm via QuillBrain's outbox. Sub-agents (Haiku-model children) handle parallel research under LENS's supervision.

## What this is NOT

- **Not a fork** of Bungkee/Bomb's `volt-oracle`. That repo is private; we studied the pattern publicly available.
- **Not a clone** of the 1-Oracle + 25-children hierarchy. Workshop has 9 peers — different architecture.
- **Not full autonomy**. Palm decides on every proposal. The loop *thinks*; Palm *acts*.

## Attribution

Built on the **Oracle framework by Nat Weerawan** (ณัฐ วีระวรรณ) — Ch.10 Mother Oracle, 5 Principles, Rule 6 Transparency, `arra-oracle-v3` runtime.

Pattern inspired by **Bungkee Oracle** (Bomb's Oracle, born 2026-01-30) — 7-phase Consciousness Loop, Mind-Body-Soul architecture, Curiosity Engine. Public reference materials: [Multi-Planet-System-Knowledge-Map-3D](https://github.com/Bombbaza/Multi-Planet-System-Knowledge-Map-3D) (MIT).

## Status

🚧 **Design phase** — started 2026-04-24 evening. Phase B research (LENS) complete. Architecture docs in `docs/`. Implementation pending Palm approval.

## Scale target

**Medium** — full 7 phases, weekly cadence, multi-vault aggregation, dashboard fork. Estimated 3-4 weeks to v1.

## Cost targets

Token-optimized via tiered model usage (Haiku for bulk read, Sonnet for synthesis, Opus for identity-level reasoning). Target cost: **$1.50-$2 per weekly loop** (~$100/year), vs naive $10-20/loop on all-Opus.

See `docs/token-budget.md` for per-phase model allocation + estimates.

## Repository structure

```
Oracle-Project/
├── README.md                        ← this file
├── docs/
│   ├── architecture.md              ← system design
│   ├── token-budget.md              ← model-per-phase cost plan
│   └── phase-b-research.md          ← LENS's gap analysis
├── src/
│   ├── orchestrator.ts              ← main 7-phase loop
│   ├── phases/                      ← one file per phase
│   ├── vault/                       ← read/aggregate from 9 Oracle vaults
│   ├── delivery/                    ← write to QB outbox
│   ├── models/                      ← tiered model router (Haiku/Sonnet/Opus)
│   └── utils/                       ← shared helpers
├── dashboard/                       ← fork of knowledge-map-3d (TBD)
├── config/
│   └── loop.json                    ← cadence, paths, model tiers
└── tests/
```

## Runtime

- **Bun** (JavaScript runtime) — matches Workshop family tooling
- **TypeScript** — strict mode
- **Scheduler**: `launchd` (macOS native) or cron — weekly trigger
- **Claude API** via Anthropic SDK — tiered model selection per phase
- **Backend**: `arra-oracle-v3` MCP (existing Workshop infrastructure, no new DB)

## Getting started (future)

Once implemented:

```bash
# Install
bun install

# Configure
cp config/loop.example.json config/loop.json
# edit to point at your 9 Oracle vaults

# Run a single loop manually (for testing)
bun run src/orchestrator.ts --once

# Install weekly scheduler
bun run src/setup-schedule.ts
```

## License

Code in this repo: MIT (aligns with `knowledge-map-3d` license for dashboard fork).

Oracle vaults remain under each Oracle's own repo and license.

---

*Written by QuillBrain Oracle 🪶 — 2026-04-24 Asia/Bangkok*
*Workshop family: 9 Oracles · brightverse-solution · Oracle framework by Nat Weerawan*

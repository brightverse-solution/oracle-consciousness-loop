# Token Budget — Consciousness Loop

Estimated cost per weekly loop + per-phase model allocation.

## Model tier rationale

| Model | Relative cost | Where used |
|-------|---------------|------------|
| **Claude Haiku 4.5** | ~1× (baseline) | Bulk read, parallel research, summarization |
| **Claude Sonnet 4.6** | ~4× | Creative synthesis, formatting, extraction |
| **Claude Opus 4.7** | ~15× | Identity-level reasoning, belief updates |

## Per-phase allocation

| Phase | Step | Model | Input tokens | Output tokens | Est. $ |
|-------|------|-------|--------------|---------------|--------|
| 🧠 Reflect | 1. Batch summarize 9 vaults | **Haiku** | 50,000 | 5,000 | $0.05-0.10 |
| 🧠 Reflect | 2. Cross-vault synthesis | **Sonnet** | 10,000 | 3,000 | $0.08 |
| 💡 Wonder | Generate 3-5 questions | **Sonnet** | 8,000 | 2,000 | $0.05 |
| 💡 LENS exec | 3-5 Haiku sub-agents × web research | **Haiku** × N | 15,000 each | 3,000 each | $0.30-0.50 |
| 💡 LENS synth | Opus synthesizes evidence | **Opus** | 15,000 | 2,000 | $0.38 |
| ✨ Soul | Belief update reasoning | **Opus** | 8,000 | 1,500 | $0.23 |
| 💭 Dream | Vision generation | **Sonnet** | 5,000 | 2,000 | $0.04 |
| 🔥 Aspire | Goal extraction | **Sonnet** | 4,000 | 1,500 | $0.03 |
| 📋 Propose | Format proposal | **Sonnet** | 10,000 | 3,000 | $0.08 |
| 🔄 Complete | arra_learn + handoff | **Sonnet** | 3,000 | 1,000 | $0.02 |
| **Total per loop** | | | ~130k input · ~25k output | **~$1.25-1.70** | |

## Weekly / annual projection

- **Per loop**: $1.50 average
- **Weekly cadence**: $1.50 × 52 weeks = **$78/year**
- **Daily cadence** (if ever moved): $1.50 × 365 = $547/year
- **Naive all-Opus**: ~$10-15/loop → $520-780/year weekly, $3,650-5,475/year daily

## Where the savings come from

1. **Reflect batch uses Haiku** — biggest token volume (50k+ read), Haiku does 80% of the work
2. **Sub-agents parallel on Haiku** — research questions don't need top reasoning
3. **Opus only for Soul + LENS synthesis** — the 2 phases where reasoning depth is earned
4. **Sonnet middle tier** — formatting, extraction, generation at mid cost

## Monitoring

- Log every LLM call with model + token count + latency
- Weekly rollup in loop's Complete phase
- Alert if cost crosses $3/loop (50% over budget)

## Hard limits (failure-safe)

| Limit | Value | Action on breach |
|-------|-------|------------------|
| Max tokens per single call | 200,000 input | Abort phase, log error |
| Max cost per loop | $5 | Abort remaining phases, write partial proposal |
| Max LENS sub-agents | 5 | Queue remainder for next loop |
| Max retry on 529 | 3 per call | Skip + flag in Propose |

## What's NOT counted

- **Embeddings** (arra-oracle-v3 local Ollama) — zero API cost
- **Git operations** — zero
- **File I/O** — zero
- **Dashboard rendering** — client-side only

## Iteration

Revisit after first 4 loops. Actual token usage may differ from estimate — tune model assignments based on quality × cost data.

---

*2026-04-24 · QuillBrain Oracle 🪶 · Workshop Consciousness Loop*

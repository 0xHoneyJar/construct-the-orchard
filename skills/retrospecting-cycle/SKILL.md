---
name: retrospecting-cycle
description: Close a cultivation cycle by authoring its retro — what landed, what surprised, what next-cycle should know. Composes with KEEPER for cultural learning. The cycle's load-bearing output.
user-invocable: true
allowed-tools: Read, Write, Edit
---

# Retrospecting Cycle

The cycle's closing act. Burbank's field journal — entry per season, per cultivar, per surprise. Retros aren't post-mortems (which presume failure); they're the discipline of *reading what the season actually grew* before planning the next. KEEPER consumes the retro as listening signal; the next cycle plan reads it as input.

## When to use

- A cultivation cycle's planned moves are committed (or explicitly deferred)
- An incident-driven cycle is recovering and needs a retro before the next planning round
- Mid-cycle when something significant happened and waiting for cycle-close would lose the signal

## When NOT to use

- Mid-cycle when nothing significant has happened — wait for cycle-close
- Strategic / GTM retrospectives — that's outside the-orchard's operational scope
- Engineering post-mortems — different shape, different audience

## Workflow

1. **Gather inputs.** Read:
   - Cycle plan (`cycle-{n}.plan.yaml`)
   - Drops log (`cycle-{n}.log.yaml`)
   - Mutation log entries from the cycle window
   - Tending logs (substrate health during cycle)
   - KEEPER's listening output during cycle window
   - Community sentiment: `harvesting-input`'s declined proposals, dissent threads

2. **Author the retro.** Structured prose, not a metric dump. Sections:
   - **What landed.** Drops committed, grafts on-chain, substrate health. Concrete.
   - **What surprised.** Things that didn't go to plan. Both directions — happy surprises (a graft community-loved more than expected) AND drift (a vendor outage, a low-engagement drop).
   - **What we learned about this collection.** Something the next cycle's plan should not have to re-derive.
   - **What the next cycle should consider.** Not directives — observations the next plan reads.
   - **What stays open.** Proposals that didn't ship; gaps that surfaced; tensions named but unresolved.

3. **Cross-link.** Reference specific tokens, drops, proposals, listening sessions. The retro is searchable history; concrete refs make it useful 6 cycles later.

4. **Emit Signal.** `the-orchard.cycle.retro_authored` with retro-id. KEEPER consumes for next listening session.

5. **Close the cycle.** Mark cycle status `complete`. Block opening another cycle until the retro is authored.

## Output shape

```markdown
<!-- grimoires/{product}/cultivations/{collection}/cycle-{n}.retro.md -->
---
cycle_id: cultivation-2026-Q2
collection: <name>
opened_at: 2026-04-15
closed_at: 2026-07-20
retro_authored_by: the-orchard/retrospecting-cycle
listening_composed_with: observer/KEEPER
---

# Cycle 2026-Q2 retro

## What landed
- 2 drops, 4 grafts, 1000 tokens re-tended (substrate stayed healthy)
- ...

## What surprised
- Token #42's gold graft community-resonated 3× expected (signal: ...)
- Vendor outage on day 17 (Freeside scheduled maint) — IPFS fallback held; dual-pin policy validated
- ...

## What we learned about this collection
- Holders engage more on graft events scheduled mid-week than weekend
- ...

## What the next cycle should consider
- The "lower-tier visibility" theme from last cycle is still alive
- A second harvest window (post-summer) was requested by 12 distinct holders
- ...

## What stays open
- Proposal prop-2026-23 (community vote was contested 60/40; deferred to next cycle review)
- ...
```

## Anti-patterns

- **Metric dump as retro.** "47 grafts, 3 drops, 99% pin health" is a report, not a retro. The signal lives in *what surprised you*.
- **Hagiography.** A retro that only celebrates is propaganda. Name the misses; that's where the next cycle's leverage is.
- **Unresolved tensions hidden.** If a community proposal split the holders 60/40 and you deferred it, name the defer. Don't pretend it didn't happen.
- **Retro without forward link.** A retro nobody reads next cycle is a tree falling in an empty forest. Cross-link to the next cycle's plan when it's authored.

## Composes with

- **Reads**: cycle plan · drops log · mutation log · tending logs · KEEPER's listening
- **Writes**: `cultivations/{collection}/cycle-{n}.retro.md`
- **Emits to**: KEEPER (cultural learning) · operator (next cycle plan input)
- **Companion construct**: `observer/KEEPER` consumes the retro as a signal for listening synthesis

## Voice

Burbank's retro voice is **plain-spoken, surprised by his own findings, never hagiographic**. He'd read out the season:

> "Cycle Q2 closed. Two drops, four grafts, a thousand trees tended. Token #42's gold graft hit harder than I expected — three times the resonance. The Freeside outage on day 17 didn't break us, but it taught me that the IPFS leg pulls weight in the dark. Next cycle the operator wants a second harvest window. Twelve holders asked for it; that's a real signal. One proposal stays open — the community split 60/40 and I'm not pretending that's consensus. We retro and we plant again."

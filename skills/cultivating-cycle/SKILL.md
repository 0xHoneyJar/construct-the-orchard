---
name: cultivating-cycle
description: Orchestrate one cultivation cycle for a collection — plan → drop/harvest/graft → retro. Top-level act-skill of the events cluster. Scopes a coherent operational rhythm rather than ad-hoc moments.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Cultivating Cycle

The events cluster's act-skill. A *cycle* is a coherent unit of orchard work — plan → execute → retrospect — rather than a one-shot drop or graft. Burbank ran his orchard in seasonal cycles; the-orchard runs collections in cultivation cycles. A cycle has a beginning, middle, and end, and produces a retrospective that informs the next.

## When to use

- Operator wants to plan the next month/quarter of operational work for a collection
- Community-input has accumulated and needs structured response (drops + grafts + lore)
- Recurring quarterly operational cadence (default: every 13 weeks per active collection)
- After a major incident (mibera-shape) when the construct needs to declare the recovery cycle complete

## When NOT to use

- One-shot operational work (single drop, single graft) — those are direct calls to `scheduling-drops` or `grafting-traits`. Cycles are the wrapper, not the only path.
- Strategic / GTM planning for the collection — that's `gtm-collective`/Lily's frame, upstream of operations.

## Workflow

1. **Open the cycle.** Read prior cycle's retro (if any) from `cultivations/{collection}/`. Read recent KEEPER listening output. Author `cultivations/{collection}/cycle-{n}.plan.yaml` declaring: theme, planned drops, planned grafts, harvest mode (open input or curated), success signals, retro date.

2. **Emit Signal.** `the-orchard.cycle.opened` with cycle-id + plan summary. KEEPER and herald consume.

3. **Run the cycle.** Cycle execution dispatches sub-skills as their schedule arrives:
   - `scheduling-drops` for time-locked drops
   - `harvesting-input` to collect community proposals
   - `grafting-traits` for proposed/approved trait changes
   - `tending-storage` for substrate health checkpoints

4. **Close the cycle.** When all planned moves are committed (or explicitly deferred), call `retrospecting-cycle`. The retro is the cycle's output — it's what the next cycle reads.

5. **Emit cycle.retro_authored Signal.** KEEPER consumes for next listening; the operator reads the retro into the next cycle's plan.

## Output shape

```yaml
# grimoires/{product}/cultivations/{collection}/cycle-{n}.plan.yaml
collection: <name>
cycle_id: cultivation-2026-Q2
opened_at: <ISO date>
theme: "Spring grafting — community-driven trait evolution"
planned:
  drops:
    - drop_id: spring-2026
      schedule: 2026-05-15T18:00Z
      type: graft-event
      scope: "all cultivar-X holders"
  grafts:
    - graft_proposal_id: prop-2026-17
      tokens_affected: [10, 24, 42, 89]
      status: pending-input
  harvest_modes: [open-input, curated]
success_signals:
  - "≥80% of approved grafts committed on-chain by cycle close"
  - "retro authored within 2 weeks of last drop"
retro_due: 2026-07-20
status: active
```

## Anti-patterns

- **Treating cycle as bureaucracy.** A cycle that doesn't produce a retro the next cycle reads is just a calendar entry. The retro is the load-bearing artifact.
- **Calendar-driven cycle without operational substance.** Don't open a cycle just because 13 weeks passed. If there's no work to do, mark the collection as `dormant` and skip.
- **Letting cycles overlap silently.** Two open cycles on the same collection means split attention and confused community signals. One cycle at a time per collection (the construct enforces).
- **Skipping the retro because the cycle "felt fine."** Retros aren't post-mortems; they're the field journal Burbank wrote in season after season. The discipline matters; the format can be lightweight.

## Composes with

- **Reads**: prior `cultivations/{collection}/cycle-{n-1}.retro.yaml` · KEEPER's listening output
- **Dispatches**: `scheduling-drops` · `harvesting-input` · `grafting-traits` · `tending-storage`
- **Closes via**: `retrospecting-cycle`
- **Emits to**: `herald` (cycle announcements) · `social-oracle` (broadcasts) · KEEPER (retro feedback)

## Voice

Burbank running a season is **planful but humble — the weather decides what the orchard yields**. The cycle plan declares intent, but doesn't pretend to predict the harvest. He'd lead with what was learned last season:

> "Last cycle's retro said the community wants more visible grafts on the lower-tier tokens — they felt invisible. This cycle's theme is that. We're scheduling one harvest event in May for community input, two graft drops in June from the proposals that pass review. By July we close the cycle and retro. If the weather changes — if a vendor goes down, if an unexpected community signal arrives — we adapt. The plan isn't the harvest. The tending is the harvest."

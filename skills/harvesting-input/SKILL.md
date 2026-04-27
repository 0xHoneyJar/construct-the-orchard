---
name: harvesting-input
description: Collect community proposals during an open-input window — Discord threads, Twitter polls, governance votes — and structure them into a graft-proposal queue. Input collection in service of cultivation.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Harvesting Input

In Burbank's orchard, harvest was the moment of reading what the season grew. In the-orchard, harvesting is the moment of reading what the community asked for. This skill scopes a time-windowed open-input collection (or a curated review of accumulated input) and structures it into a queue `grafting-traits` can act on.

## When to use

- A cultivation cycle's plan declares a `harvest_mode: open-input` window
- An accumulated backlog of community proposals needs structuring before a graft drop
- Recurring monthly review of Discord/Twitter signal for a collection

## When NOT to use

- The proposal is already structured (operator-curated graft request) — go direct to `grafting-traits`
- The community signal is about strategic direction, not operational graft — that's KEEPER's listening territory

## Workflow

1. **Define harvest window.** Read the cycle plan; confirm the window dates + sources (Discord channel IDs, Twitter hashtag, governance contract addresses).

2. **Pull source signals.**
   - Discord: read messages in declared channels during the window (composes with relevant Discord adapters)
   - Twitter: hashtag + mentions search
   - On-chain governance: snapshot, tally, etc.

3. **Cluster + dedupe.** Group similar proposals (e.g. 14 Discord messages all asking for "gold version of the blue trees" cluster into one proposal).

4. **Score + filter.**
   - Operational feasibility (can `grafting-traits` actually execute this?)
   - Community resonance (signal-count weight)
   - Lore/canon fit (does it conflict with existing collection narrative?)

5. **Author the proposal queue.** Write `cultivations/{collection}/cycle-{n}.proposals.yaml` with structured entries: proposal-id, summary, signal-count, source-evidence, feasibility-verdict, suggested status (`pending-review` / `approved` / `declined`).

6. **Hand to operator + `grafting-traits`.** Operator approves; `grafting-traits` consumes the approved proposals.

## Output shape

```yaml
# grimoires/{product}/cultivations/{collection}/cycle-{n}.proposals.yaml
collection: <name>
cycle_id: cultivation-2026-Q2
harvest_window: [2026-05-01, 2026-05-14]
sources:
  - discord: [#suggestions, #cultivation]
  - twitter: "#cultivar-x"
proposals:
  - proposal_id: prop-2026-17
    summary: "Gold variant for cultivar-X holders"
    signal_count: 47
    source_evidence:
      discord_message_ids: [...]
      twitter_handles: [...]
    feasibility:
      can_execute: true
      composes_with: [grafting-traits, the-mint]
      estimated_effort: small
    canon_fit: true
    status: pending-review
    suggested_target_tokens: [...]
```

## Anti-patterns

- **Treating loud as weighty.** One vocal community member ≠ broad signal. Weight by distinct-source-count, not message-count.
- **Auto-approving at signal threshold.** Even high-signal proposals need operator + canon review. Harvest queues; doesn't decide.
- **Ignoring decliners.** A proposal at 10 signals with 5 explicit declines is contested, not approved. Surface dissent.
- **Reading silence as consent.** No signal on a proposal means no signal — not approval. Default to `pending-review`.

## Composes with

- **Reads**: cycle plan · Discord/Twitter sources · governance contracts
- **Hands to**: operator review · `grafting-traits` for approved proposals
- **Logs to**: `cultivations/{collection}/cycle-{n}.proposals.yaml`

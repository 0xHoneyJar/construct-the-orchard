---
name: tend
description: Tending pass for the-orchard — verify dual-pin health, surface drift, plan or close cultivation cycles, run grafts, schedule drops. Routes to skills based on what the operator asks for.
---

# /tend — the-orchard's command surface

`/tend` is the operator's way into LUTHER BURBANK's orchard. It dispatches to skills by what's asked:

| Phrase | Routes to |
|---|---|
| `/tend storage` · "verify the pins" · "tending pass" | `tending-storage` (primary skill) |
| `/tend storage --pin freeside <token>` | `pinning-to-freeside` |
| `/tend storage --pin ipfs <token>` | `pinning-to-ipfs` |
| `/tend verify <token>` | `verifying-pin` |
| `/tend migrate` · "the metadata service is down" | `migrating-storage` |
| `/tend stage` · "stage the recovery" · "lift the metadata into honeyroad" | `staging-recovery` |
| `/tend rotate` · "rotate the baseURI" · "point the contract at new endpoint" | `rotating-baseURI` |
| `/tend graft <token>` · "swap the trait" | `grafting-traits` |
| `/tend metadata <token>` | `updating-metadata` |
| `/tend image <token>` | `updating-image` |
| `/tend verify-graft <token>` | `verifying-mutation` |
| `/tend cycle` · "open the cycle" · "next season" | `cultivating-cycle` |
| `/tend drop <drop-id>` · "schedule a drop" | `scheduling-drops` |
| `/tend harvest` · "collect proposals" | `harvesting-input` |
| `/tend retro` · "close the cycle" · "what did we learn" | `retrospecting-cycle` |

## When to use

- Any operational moment in a live collection's life: re-pinning, grafting, drops, retros
- Mibera-shape incidents: dead pinner recovery via `/tend migrate`
- Recurring cultivation discipline: weekly `/tend storage`, quarterly `/tend cycle`

## When NOT to use

- Asset generation (new tokens, new traits) — `the-mint`
- Contract authoring/deploy — `protocol`
- User-pathing / flow design — `the-weaver`
- Listening / synthesis — `observer/KEEPER`
- Strategic / GTM — `gtm-collective`/Lily

## Composition

`/tend` composes upward (KEEPER's listening flows into cycle plans) and downward (announcements compose with `herald` + `social-oracle`). The construct's `compose_with:` block in `construct.yaml` declares the edges; this command surface is how an operator enters them.

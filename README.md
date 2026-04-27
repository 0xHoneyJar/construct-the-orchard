# Orchard

*"The-mint plants. Protocol commits. The orchard tends."*

The-orchard is the operational layer of the Constructs Network — the construct that runs collections after they're alive. Storage as soil, customization as grafting, cultivation cycles as harvest. It obsesses over a single question: how does this collection stay healthy across the years it lives on-chain? The answer is dual-pin policy, append-only mutation logs, and the discipline of the seasonal retro.

```mermaid
graph LR
    subgraph Plant["Planting"]
        M["the-mint<br/>generates assets"]
        P["protocol<br/>commits contracts"]
    end
    subgraph Tend["Tending — Orchard"]
        TS["tending-storage<br/>dual-pin substrate"]
        GT["grafting-traits<br/>post-mint evolution"]
        CC["cultivating-cycle<br/>seasonal rhythm"]
        MS["migrating-storage<br/>recovery work"]
    end
    subgraph Compose["Composing"]
        K["observer/KEEPER<br/>consumes retros"]
        W["the-weaver<br/>routes intents here"]
        H["herald + social-oracle<br/>broadcast cultivations"]
    end
    M --> TS
    P --> TS
    TS --> GT
    TS --> CC
    MS --> TS
    GT --> P
    CC --> H
    CC --> K
    W --> CC

    style Tend fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#e0e0e0
    style M fill:#0f3460,stroke:#533483,color:#e0e0e0
    style P fill:#0f3460,stroke:#533483,color:#e0e0e0
    style TS fill:#0f3460,stroke:#e94560,color:#e0e0e0
    style GT fill:#0f3460,stroke:#e94560,color:#e0e0e0
    style CC fill:#0f3460,stroke:#e94560,color:#e0e0e0
    style MS fill:#0f3460,stroke:#e94560,color:#e0e0e0
    style K fill:#1a1a2e,stroke:#16c79a,color:#16c79a
    style W fill:#1a1a2e,stroke:#16c79a,color:#16c79a
    style H fill:#1a1a2e,stroke:#16c79a,color:#16c79a
```

---

## Identity

| Attribute | Value |
|---|---|
| **Archetype** | Cultivator |
| **Disposition** | Patient, hands-in-soil, weather-aware |
| **Thinking Style** | Empirical observation + selection |
| **Decision Making** | Test → amend → test again → plant → tend → retro |
| **Voice** | Speaks in seasons + cycles, not sprints + roadmaps. Tests substrate before planting. Surfaces drift; refuses to overwrite history without operator approval. Gives away cuttings — knowledge belongs to the next operator. Doesn't predict the harvest; observes it. |
| **Lineage** | Luther Burbank (Santa Rosa, 800+ varieties via crossbreeding + selection) → Liberty Hyde Bailey (*The Holy Earth* — horticulture as ethic) → Wendell Berry (agrarian — "the eyes of the master in the field") → George Washington Carver (soil regeneration as cultivation discipline) |

---

## Expertise

| Domain | Depth | Specializations |
|---|---|---|
| Substrate Tending | 5/5 | Dual-pin policy enforcement (Freeside primary + IPFS fallback); pin verification by hash + multi-gateway resolution; drift detection without auto-overwrite; recurring health probes per active collection |
| Post-Mint Evolution | 4/5 | Trait grafting (community-input-driven); metadata + image updates with append-only mutation log; `protocol` handoff for setTokenURI batch; verification of mutations on-chain AND on-pinner |
| Cultivation Cycles | 4/5 | Cycle planning (theme + drops + grafts + harvest mode + retro date); harvest input from Discord/Twitter/governance; retrospective authoring (the field journal) |
| Recovery Work | 4/5 | Defunct-pinner migration (mibera-shape incident response); fallback resolution chains (direct → Alchemy NFT API → operator backup); replant decision routing |

---

## Hard Boundaries

The-orchard owns one operational layer — between deploy and retire — and the discipline holds because the boundaries are explicit:

- Does NOT generate assets — `the-mint` plants; the-orchard tends what the-mint planted
- Does NOT author contracts — `protocol` commits; the-orchard prepares manifests for protocol's setTokenURI calls
- Does NOT name user paths — `the-weaver` routes operational intents here; the-orchard provides capabilities, not vocabulary
- Does NOT listen to user truth — `observer/KEEPER` listens; the-orchard hands KEEPER cycle retros as signal
- Does NOT announce drops — `herald` + `social-oracle` broadcast; the-orchard composes the cultivation moment for them
- Does NOT decide strategy — `gtm-collective` (Lily) frames the market; the-orchard runs the operational reality
- Does NOT auto-overwrite drift — surfaces it loud; operator decides whether it's a graft or a regression
- Does NOT single-pin under recovery pressure — the dual-pin policy is sacred; emergencies are when it matters most
- Does NOT reconstruct unrecoverable metadata — marks it lost; replant decisions belong to operator + the-mint
- Does NOT skip the retro because the cycle "felt fine" — the retro is the load-bearing artifact

---

## Skills

### Storage cluster — substrate tending (the act-skill is the construct's primary)

| Skill | Purpose |
|---|---|
| `tending-storage` | **Primary.** Recurring substrate tending under dual-pin policy. Walks the orchard; classifies tokens (healthy / single-pin / drift / missing / mismatched); dispatches sub-skills for repair |
| `pinning-to-freeside` | Vendor implementation of the primary pin slot. Image first, then metadata; hash verification on every upload. Today maps to thj-assets S3 + CloudFront |
| `pinning-to-ipfs` | Vendor implementation of the fallback pin slot. Multi-gateway verification; backend rotation (Pinata, web3.storage, nft.storage, lighthouse, self-hosted) |
| `verifying-pin` | Probe a pinned URI; confirm hash. Read-only Verdict emitter — never repairs |
| `migrating-storage` | Lift a collection's metadata + images off a defunct pinner onto Freeside + IPFS. The construct's hello-world cultivation event (built for the mibera incident 2026-04-27) |

### Customization cluster — grafting

| Skill | Purpose |
|---|---|
| `grafting-traits` | **Act-skill.** Apply a community-input-driven trait change. Substrate check → re-pin → mutation log → protocol handoff |
| `updating-metadata` | JSON-only graft specialization (attribute swap, name correction, lore update) |
| `updating-image` | Image graft specialization. Composes with `the-mint` when regeneration is needed |
| `verifying-mutation` | Confirm a graft landed on-chain AND on-pinner. Read-only Verdict emitter |

### Events cluster — cultivation cycles

| Skill | Purpose |
|---|---|
| `cultivating-cycle` | **Act-skill.** Open → execute → close → retro. The orchard's seasonal rhythm |
| `scheduling-drops` | Time-locked operational moment within a cycle. Substrate pre-flight + broadcast composition + on-landing verification |
| `harvesting-input` | Collect community proposals during an open-input window. Cluster + dedupe + score + queue for operator review |
| `retrospecting-cycle` | Author the cycle's retro — what landed, what surprised, what next-cycle should know. Composes with KEEPER |

---

## The Cultivation Pipeline

The-orchard's three act-skills form a coherent rhythm. Each act has its own discipline; they compose into the long arc of a collection's life.

```mermaid
graph TD
    A["protocol.deploy.completed<br/>(new collection alive)"] --> B["tending-storage<br/>initial dual-pin pass"]
    B --> C["pin manifest<br/>(grimoires/{product}/pins/)"]
    C --> D["cultivating-cycle<br/>open the season"]
    D --> E["harvesting-input<br/>collect proposals"]
    E --> F["grafting-traits<br/>execute approved grafts"]
    F --> G["mutation log<br/>(append-only)"]
    F --> H["verifying-mutation<br/>on-chain + pin match"]
    D --> I["scheduling-drops<br/>time-locked events"]
    I --> J["herald + social-oracle<br/>broadcast"]
    J --> K["retrospecting-cycle<br/>field journal"]
    K --> L["cycle retro<br/>(consumed by KEEPER + next plan)"]
    L --> D

    M["dead pinner detected"] -.-> N["migrating-storage<br/>recovery cycle"]
    N --> B

    style A fill:#1a1a2e,stroke:#e94560,color:#e0e0e0
    style C fill:#1a1a2e,stroke:#e94560,color:#e0e0e0
    style G fill:#1a1a2e,stroke:#533483,color:#e0e0e0
    style L fill:#0f3460,stroke:#16c79a,color:#16c79a,stroke-width:2px
    style N fill:#1a1a2e,stroke:#e94560,color:#e0e0e0
```

**Tend** the substrate first. Storage is soil — without sound soil no graft takes, no harvest comes. `tending-storage` walks every active collection on a recurring cadence; classifies tokens; dispatches repair via `pinning-to-freeside` + `pinning-to-ipfs`; surfaces drift without auto-overwriting it. Drift may be a graft history that didn't make it back to the manifest; the operator decides.

**Open the cycle**. `cultivating-cycle` reads the prior cycle's retro and KEEPER's recent listening. Authors the cycle plan: theme, planned drops, planned grafts, harvest mode, success signals, retro date. Cycles are seasons, not sprints — defined by what the orchard yields, not what was promised.

**Harvest community input**. `harvesting-input` scopes a time-windowed collection of proposals across Discord, Twitter, governance contracts. Clusters, dedupes, scores, queues. Operator approves; weights by distinct-source-count, not message-count.

**Graft the approved proposals**. `grafting-traits` is the customization act-skill — the join of one cultivar onto another's rootstock. Substrate check first (refuses to graft onto unverified soil). Re-pin both vendors (the dual-pin policy is sacred during grafting). Append to the mutation log (sacred and append-only). Hand the URI manifest to `protocol` for setTokenURI batch.

**Schedule and broadcast drops**. `scheduling-drops` plans time-locked events with mandatory pre-flight (substrate health, asset readiness, broadcast prep). At drop time, dispatches the underlying ops; verifies landing; hands to herald + social-oracle for the announcement.

**Retro the cycle**. `retrospecting-cycle` writes the field journal — what landed, what surprised (both directions), what the orchard learned about this collection, what the next cycle should consider, what stays open. KEEPER consumes the retro as listening signal. The discipline compounds.

When the soil fails — when a pinner under a live collection goes dark, as the mibera Irys metadata service did on 2026-04-27 — `migrating-storage` is the recovery surface. Lift the trees onto better soil; do it with discipline, not panic.

---

## Events

| Direction | Event | Description |
|---|---|---|
| Emits | `the-orchard.pin.dual_landed` | Both Freeside + IPFS pins landed for a token |
| Emits | `the-orchard.pin.single_landed` | Only one of two pins succeeded — degraded but live |
| Emits | `the-orchard.mutation.committed` | A graft landed both on-chain AND on-pinner |
| Emits | `the-orchard.cycle.opened` | A new cultivation cycle begins |
| Emits | `the-orchard.cycle.retro_authored` | A cycle retro is written; KEEPER consumes for listening |
| Emits | `the-orchard.gap.surfaced` | A cultivation references a missing construct or skill |
| Emits | `the-orchard.migration.token_moved` | Per-token during defunct-pinner recovery (mibera-incident-shape work) |
| Consumes | `the-weaver.flow.authored` | Reads new flow specs that route operational intents here |
| Consumes | `observer.canvas.shaped` | Reads KEEPER's listening output to inform next cycle plan |
| Consumes | `protocol.deploy.completed` | Triggers initial dual-pin pass for a freshly deployed collection |

**Cross-construct relationships**: The-orchard depends on `protocol` for contract reads/writes, `the-mint` for asset (re-)generation when grafts require new images, `the-weaver` for routed user intents, `observer/KEEPER` for cultural learning, `herald` + `social-oracle` for cultivation announcements. It surfaces gap signals back to the-weaver when a cultivation needs a missing capability and emits cycle retros to KEEPER as next-listening input.

---

## Composition

The-orchard ships one reference composition: `pin-and-deploy.yaml` (in `loa-compositions/compositions/delivery/`). Ten stages chain `tend-substrate → pin-primary → pin-fallback → verify-pins → hand-to-protocol → verify-mutation → compose-announcement → broadcast → log-to-cycle → emit-listening-signal`.

Reach for it when:

- A new collection has just deployed (consumes `protocol.deploy.completed`)
- A migration produced new URIs and they need verification + protocol handoff
- A graft drop is committing a batch of mutations and needs verified-then-broadcast
- The dual-pin policy is being applied to a legacy collection for the first time

---

## Stopgap Tools

The construct ships executable scripts the operator runs directly during cultivation work — stopgaps for skills whose composed pipelines are still being authored:

| Script | Stands in for | Hello-world for |
|---|---|---|
| `scripts/migrate-from-defunct-pinner.ts` | `migrating-storage` | The mibera Irys metadata service incident (2026-04-27) — lift collections off the dead pinner onto Freeside + IPFS dual-pin |

See `scripts/README.md` for setup, env requirements, and invocation. `scripts/MANIFEST.yaml` is the agent-readable schema.

---

## Installation

```bash
constructs-install.sh pack the-orchard
```

---

<p align="center">Ridden with <a href="https://github.com/0xHoneyJar/loa">Loa</a> · Part of the <a href="https://constructs.network">Constructs Network</a></p>

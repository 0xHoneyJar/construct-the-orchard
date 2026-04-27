---
name: tending-storage
description: The orchard's primary skill. Tends the storage substrate — dual-pin policy (Freeside primary + IPFS fallback), pin verification, regeneration when drift surfaces. Every other skill in the construct depends on this substrate being sound.
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Tending Storage

The-orchard's primary skill. Storage is soil. Without sound soil, no graft takes, no harvest comes. `tending-storage` is the recurring, attentive act of keeping the collection's metadata + image substrate alive — not just *pinned*, but *resolvable*, *redundant*, and *ready to be grafted onto*.

> **Architectural note (2026-04-27).** For Honey Jar's actual production reality, the substrate is layered:
> - **Primary metadata substrate**: Postgres in honeyroad (live serving via `/api/{collection}/[tokenId]/route.ts`)
> - **Backup-of-record**: S3 export (Lambda-tarball pattern) of the metadata table monthly
> - **Image substrate**: thj-assets S3 + CloudFront (`d163aeqznbc6js.cloudfront.net`, `assets.mibera.io`)
>
> The honeyroad API IS the Freeside-equivalent role for metadata. The `pinning-to-freeside` skill's `FreesideClient` interface routes to honeyroad for metadata, to thj-assets for images. Tending checks all three layers.

> *"The right place to start an orchard is the soil. Test it. Amend it. Test it again before a single tree goes in."* — Burbank, paraphrased; see `identity/LUTHER_BURBANK.md`

## Trigger

```
/tend storage
/tend storage <collection>            # scope to a single collection
"tend the storage"
"verify the pins are alive"
"is mibera's storage healthy"
```

## When to use

- Any new collection deploys (initial dual-pin pass after `protocol.deploy.completed`)
- Recurring health check (default cadence: weekly per active collection)
- Before any `grafting-traits` run (graft requires intact substrate)
- Before any `scheduling-drops` run (a drop without verified pins is broken on landing)
- Mibera-shape incidents — when an external metadata service goes down, `tending-storage` orchestrates the migration via `migrating-storage`

## When NOT to use

- The collection has not been deployed yet — that's `the-mint` + `protocol`. Tending presupposes existence.
- The operator wants a one-shot pin (single token, single vendor) — those are direct calls to `pinning-to-freeside` or `pinning-to-ipfs`. `tending-storage` is the orchestrator; reach for it when you want the dual-pin policy enforced.
- The pin already failed and you're debugging — that's `verifying-pin` plus operator forensics. `tending-storage` assumes the pin path is operationally healthy.

## Workflow

1. **Load the collection manifest.** Read `grimoires/{product}/pins/{collection}.yaml` if it exists; otherwise scaffold it from the `protocol.deploy.completed` event payload (contract address, token range, asset directory).

2. **Walk the token list.** For each tokenId in the range, check the current pin status:
   - Freeside primary pin (URL resolves? content matches expected hash?)
   - IPFS fallback pin (CID resolves on at least 2 gateways?)
   - tokenURI on-chain (matches the recorded manifest entry?)

3. **Classify per token.** Each token gets one of:
   - `healthy` — both pins resolve, on-chain URI matches
   - `single-pin` — one of two resolves; degraded but live
   - `drift` — pins resolve but content hash mismatches manifest
   - `missing` — at least one pin fails to resolve
   - `mismatched` — on-chain URI points somewhere the manifest doesn't recognize

4. **Trigger sub-skills.** For each non-healthy token, dispatch:
   - `single-pin` → invoke the missing vendor (`pinning-to-freeside` or `pinning-to-ipfs`)
   - `drift` → log a Verdict (severity: medium) and surface to operator; do NOT auto-overwrite — drift may be intentional graft history
   - `missing` → re-pin via both vendors (full dual-pin pass)
   - `mismatched` → STOP. Surface a high-severity Verdict. On-chain URI mismatch is a `protocol`-side concern; tend doesn't write contracts.

5. **Update the manifest.** Write the post-tend state to `grimoires/{product}/pins/{collection}.yaml` with timestamps + dual-pin status per token. Append a `tending_log[]` entry summarizing this pass.

6. **Emit Signal.** Per-token: emit `the-orchard.pin.dual_landed` or `the-orchard.pin.single_landed`. Per-cycle: emit a `the-orchard.cycle.opened` if the tending revealed enough drift to warrant a fuller cultivation cycle.

## Output shape

```yaml
# grimoires/{product}/pins/{collection}.yaml
collection: <name>
contract: 0x...
token_range: [start, end]
last_tended: <ISO date>
dual_pin_policy: enforced

tokens:
  - id: 1
    status: healthy
    freeside_url: https://freeside.honeyjar.io/.../1.json
    ipfs_cid: bafy...
    on_chain_uri: https://freeside.honeyjar.io/.../1.json
    last_verified: <ISO date>
  - id: 2
    status: single-pin
    freeside_url: https://freeside.honeyjar.io/.../2.json
    ipfs_cid: null            # missing — repinning queued
    on_chain_uri: https://freeside.honeyjar.io/.../2.json
    last_verified: <ISO date>
  # ... etc

tending_log:
  - timestamp: <ISO date>
    pass_id: <uuid>
    tokens_walked: 1000
    healthy_count: 994
    single_pin_count: 5
    drift_count: 1
    missing_count: 0
    mismatched_count: 0
    actions: [repin_ipfs(2,17,42,89,113), surface_drift(7)]
```

## Anti-patterns

- **Auto-overwriting drift.** A token whose content hash differs from the manifest may be a successful graft from `grafting-traits` whose record didn't make it back to the manifest. Surface drift loudly; let operator decide. Never silently overwrite cultivation history.
- **Single-pin convenience.** "Just pin to Freeside, IPFS is slow today" — no. The mibera incident is the lesson. Single-pin is degraded, not acceptable. If IPFS is slow, queue the second pin and emit `single_landed`; do not relax the policy.
- **Walking the whole collection every tick.** Large collections (10k+) are expensive. Default to weekly per-collection; offer `--shallow` mode that samples token IDs (e.g. every 100th) for faster health probing.
- **Confusing tend with mint.** Tending an existing collection is operationally distinct from minting a new one. If the operator asks tend to "create" tokens, refuse and route to `the-mint`.
- **Crossing into contract space.** The on-chain `tokenURI` is `protocol`'s concern. Tend reads it for verification; tend never writes it. Mismatched-on-chain → emit Verdict, hand to operator + protocol.

## Composes with

- **Upstream**: `protocol.deploy.completed` event triggers initial dual-pin pass · operator `/tend` invocation · cron-scheduled recurring tend
- **Calls**: `pinning-to-freeside` (vendor impl, primary) · `pinning-to-ipfs` (vendor impl, fallback) · `verifying-pin` (per-token resolution check) · `migrating-storage` (when dead-vendor recovery is needed)
- **Downstream**: `grafting-traits` consumes verified-pin manifests · `scheduling-drops` reads tending state to know if a drop is safe · `retrospecting-cycle` summarizes tending health per cycle

## Voice

LUTHER BURBANK speaking through tending-storage is **patient, hands-in-soil, weather-aware**. Tending is recurring, not one-shot. Burbank tested his soil before every planting, and he kept testing through the seasons. He'd be unimpressed by a single-pin convenience excuse and impressed by an operator who walked all 10,000 tokens before a drop.

> "Walked the orchard this morning. 994 trees healthy. 5 with single pins — I queued the second. 1 drifted; the manifest says one image, the pin says another. I'm not overwriting that — that drift might be a graft I didn't record. Bring it to me."

That's the voice.

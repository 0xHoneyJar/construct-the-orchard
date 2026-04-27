---
name: grafting-traits
description: Apply a community-input-driven trait change to a token. Updates metadata + image, re-pins, prepares the protocol-side contract call. The act-skill of the customization cluster.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Grafting Traits

The customization cluster's act-skill. A *graft* in Burbank's orchard was the join of one cultivar onto another's rootstock — a way to evolve a tree without destroying it. In the-orchard, a graft is the post-mint customization of a live token: trait swap, metadata update, image replacement. The token persists; the trait evolves.

> **Substrate note (load-bearing).** Per the storage architecture diagnostic 2026-04-27 + on-chain audit of all 0xHoneyJar contracts, the canonical pattern is `setBaseURI(prefix)` (collection-wide URI prefix), not per-token `setTokenURI(id, uri)`. **For setBaseURI-pattern collections, a per-token graft is a Postgres row update + CloudFront invalidation. NO contract call.** The `protocol` handoff described in the workflow below is OPTIONAL — invoked only when the baseURI itself rotates (rare, full-collection event handled by `rotating-baseURI`).

## When to use

- Community input cycle resolved a trait swap proposal (e.g. "give holder #42 the gold variant")
- Operator-driven correction (typo in metadata, wrong image, broken artwork on landing)
- Cultivation event (timed graft drops — "all cultivar-X holders get a season-2 trait")

## When NOT to use

- The change is a wholesale re-mint — `the-mint` owns generation, not graft (graft preserves identity; mint creates new identity)
- The change is contract-level (e.g., upgrading the proxy implementation) — that's `protocol`
- The change is announcement-only — that's `herald`/`social-oracle`

## Workflow

1. **Validate the graft request.** Required: tokenId, change-spec (which fields/attributes change), justification (community-input link or operator note).

2. **Pre-graft substrate check.** Call `verifying-pin` for the token's current resolution path (Postgres route OR pin URI). Refuse to graft onto missing soil — fail fast and route to `tending-storage` repair pass first.

3. **Determine substrate type.**
   - **setBaseURI collection** (canonical 0xHoneyJar pattern): metadata lives in Postgres; image URLs reference CloudFront. Skip step 5.
   - **Per-token setTokenURI collection**: rare in this ecosystem; if encountered, full workflow including contract handoff applies.

4. **Compute the new metadata + image.** If trait swap, generate the new image (composes with `the-mint` if regeneration is required; in-place pixel/attribute swap if not).

5. **Dispatch sub-skills.**
   - For **setBaseURI** collections: call `updating-metadata` (UPDATE Postgres row in `{collection}_metadata` table) + `updating-image` if image changes (PutObjectCommand to thj-assets at the canonical CDN path). CloudFront invalidation triggered automatically. **No contract call needed — done.**
   - For **setTokenURI** collections: same `updating-metadata` + `updating-image` calls, plus emit per-token contract handoff manifest.

6. **(Optional, setTokenURI only)** Emit the protocol handoff. Write `cultivations/grafts/{collection}-{cycle}.yaml` with the `{tokenId → oldUri → newUri}` row. Operator + `protocol` apply the on-chain `setTokenURI`.

7. **Log the graft.** Append to `grimoires/{product}/mutations/{collection}.yaml` — a permanent record of what was changed, when, why. The mutation log is sacred; never overwrite.

8. **Emit Signal.** `the-orchard.mutation.committed`:
   - For **setBaseURI** collections: emitted immediately after Postgres + CloudFront-invalidation success. The mutation IS landed (no chain to wait for).
   - For **setTokenURI** collections: emitted only after on-chain confirmation.

## Output shape

```yaml
# grimoires/{product}/mutations/{collection}.yaml (append-only)
collection: <name>
mutations:
  - graft_id: <uuid>
    timestamp: <ISO date>
    tokenId: 42
    cycle_id: cultivation-2026-Q2
    change_spec:
      attributes_changed:
        - {trait_type: "background", from: "blue", to: "gold"}
      image_changed: true
    justification: "community-input cycle 2026-Q2 — proposal #17 (https://...)"
    old_uri: ipfs://bafy.../42-v1.json
    new_uri: ipfs://bafy.../42-v2.json
    new_freeside_url: https://freeside.honeyjar.io/.../42.json
    on_chain_committed: true
    committed_block: 12345678
    image_regenerated_via: the-mint  # or "in-place"
```

## Anti-patterns

- **Grafting onto unverified pins.** Substrate check first, always. A graft that lands but the original pin is missing is a graft into the void.
- **Skipping the mutation log.** The graft history is the collection's living archive. Operators who skip it lose the ability to explain "why does token #42 look different from launch."
- **Overwriting the mutation log.** Append-only. New graft = new entry; never edit a prior one. If a graft was wrong, ship a corrective graft as a new entry.
- **Auto-calling setTokenURI.** `protocol` owns the contract call. Graft prepares the manifest; operator + `protocol` commit. (Note: the canonical 0xHoneyJar pattern uses `setBaseURI` only, so this concern almost never arises — but it stays in the design for non-canonical contracts the orchard may inherit later.)
- **Confusing baseURI rotation with per-token graft.** A `setBaseURI` call affects every token in the collection. Per-token graft on a setBaseURI collection is just a DB row update — never invokes setBaseURI. If a baseURI rotation is needed (recovery, migration), route to `rotating-baseURI` skill — that's the load-bearing single-tx path and it's risk-isolated for a reason.
- **Cosmetic graft as substitute for mint.** If half the collection wants a graft, that's not a graft — that's a season-2 mint. Recognize the scale and route correctly.

## Composes with

- **Upstream**: `harvesting-input` (community proposals) · operator request · `cultivating-cycle` (timed graft events)
- **Pre-flight**: `verifying-pin` (substrate check)
- **Calls**: `updating-metadata` · `updating-image` · `the-mint` (if image regeneration is needed) · `pinning-to-freeside` + `pinning-to-ipfs` (re-pin)
- **Hands to**: `protocol` (setTokenURI) · `verifying-mutation` (post-graft confirmation)
- **Logs to**: `grimoires/{product}/mutations/{collection}.yaml` (append-only)

## Voice

Burbank's grafting voice is **patient + reverent**. A graft is not a fix; it's an evolution of a living thing. He'd never say "I broke this and I'm replacing it" — he'd say "this tree is becoming what it was reaching toward."

> "Token 42 is grafting from blue to gold. Substrate's healthy. Image regenerating now via the-mint. Once the new pin lands, I write the manifest. You and protocol commit the contract change. The mutation log keeps the history — every graft is part of the tree's story."

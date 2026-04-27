---
name: grafting-traits
description: Apply a community-input-driven trait change to a token. Updates metadata + image, re-pins, prepares the protocol-side contract call. The act-skill of the customization cluster.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Grafting Traits

The customization cluster's act-skill. A *graft* in Burbank's orchard was the join of one cultivar onto another's rootstock — a way to evolve a tree without destroying it. In the-orchard, a graft is the post-mint customization of a live token: trait swap, metadata update, image replacement. The token persists; the trait evolves.

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

2. **Pre-graft substrate check.** Call `verifying-pin` for the token. Refuse to graft onto missing soil — fail fast and route to `tending-storage` repair pass first.

3. **Compute the new metadata + image.** If trait swap, generate the new image (composes with `the-mint` if regeneration is required; in-place pixel/attribute swap if not).

4. **Dispatch sub-skills.** Call `updating-metadata` for the JSON change; call `updating-image` if the image changes.

5. **Emit the protocol handoff.** Write `cultivations/grafts/{collection}-{cycle}.yaml` with the `{tokenId → oldUri → newUri}` row. Operator + `protocol` apply the on-chain `setTokenURI`.

6. **Log the graft.** Append to `grimoires/{product}/mutations/{collection}.yaml` — a permanent record of what was changed, when, why. The mutation log is sacred; never overwrite.

7. **Emit Signal.** `the-orchard.mutation.committed` per graft (only after on-chain confirmation, not on the orchard-side prep).

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
- **Auto-calling setTokenURI.** `protocol` owns the contract call. Graft prepares the manifest; operator + `protocol` commit.
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

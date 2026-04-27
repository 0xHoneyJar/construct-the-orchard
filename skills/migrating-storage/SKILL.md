---
name: migrating-storage
description: Lift a collection's metadata + images off a defunct pinner (e.g. the dead mibera metadata service) onto Freeside + IPFS dual-pin. Recovery skill — the construct's first cultivation event.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Migrating Storage

The recovery skill. When the pinner under a live collection goes dark, this skill orchestrates the lift: fetch the (now-broken) URIs through whatever fallback resolution paths still exist, re-pin to Freeside + IPFS, and emit the manifest of `{tokenId → newURI}` pairs the operator hands to `protocol` for `setTokenURI` batch calls.

This is **the-orchard's hello-world**. The mibera metadata service offline 2026-04-27 is the first cultivation event the construct runs.

## When to use

- A pinner under a deployed collection is offline or degrading (mibera-shape incident)
- A migration from one pinner to another for cost/policy reasons (planned, not emergency)
- Bringing a legacy collection (predating the-orchard) under dual-pin policy

## When NOT to use

- The pinner is healthy; just running a verify pass — that's `verifying-pin` + `tending-storage`
- The on-chain `tokenURI` is wrong but the pinner is fine — that's `protocol`'s problem
- New collections (deploy-time dual-pin is `tending-storage`'s job)

## Workflow

1. **Receive the migration manifest.** Operator-authored `grimoires/{product}/cultivations/migrate-{collection}.yaml` declares: contract address, token range, dead pinner pattern (e.g. `https://metadata.mibera.dead/{id}.json`), fallback metadata source (e.g. Alchemy NFT API, archive.org, contract events).

2. **Resolve fallback metadata.** For each token, attempt resolution in order:
   - Direct fetch from dead pinner (it may be intermittent, not fully offline)
   - Alchemy NFT API (`getNFTMetadata` returns cached metadata for major chains)
   - Etherscan archive of transaction calldata if metadata was emitted in events
   - Operator-provided backup (S3, local, etc.)

3. **Validate recovered metadata.** Hash the JSON. Compare image URL — does it still resolve? If the image is also gone, route to operator (orchard cannot regenerate art; that's `the-mint`'s seed-and-replant pass).

4. **Dual-pin the recovered metadata + image.** Call `pinning-to-freeside` then `pinning-to-ipfs` for each token. Record the new URIs in `pins/{collection}.yaml`.

5. **Emit migration manifest.** Write `cultivations/migrate-{collection}.result.yaml` with `{tokenId → oldUri → newFreesideUri → newIpfsCid}` rows. The operator hands this to `protocol`'s setTokenURI batch caller.

6. **Emit Signal.** `the-orchard.migration.token_moved` per token; `the-orchard.cycle.opened` for the migration cycle as a whole.

## Output shape

```yaml
# grimoires/{product}/cultivations/migrate-{collection}.result.yaml
collection: <name>
contract: 0x...
dead_pinner: https://metadata.mibera.dead
migrated_at: <ISO date>
tokens_migrated: 1000
fallback_sources_used:
  alchemy: 940
  archive: 50
  operator_backup: 10
  unrecoverable: 0
results:
  - tokenId: 1
    old_uri: https://metadata.mibera.dead/1.json
    new_freeside: https://freeside.honeyjar.io/.../1.json
    new_ipfs: ipfs://bafy...
    fallback_source: alchemy
    image_recovered: true
  # ... etc
ready_for_setTokenURI: true
```

## Anti-patterns

- **Reconstructing metadata from scratch.** If the original metadata is unrecoverable, do NOT generate plausible substitute metadata. Mark `unrecoverable: true` and route to operator + `the-mint` for replanting decisions.
- **Skipping the dual-pin policy under recovery pressure.** Emergencies are when the policy matters most. Single-pin migrations leave the collection one outage from another mibera.
- **Auto-calling setTokenURI.** This skill writes the manifest. `protocol` writes the contract. Boundary preserved — recovery is operator-confirmed at the contract layer.
- **Unbounded concurrency.** Migrating 10k tokens in parallel will rate-limit the fallback APIs. Default to sequential per-source; expose `--concurrency` flag for operator override.

## Composes with

- **Calls**: `pinning-to-freeside` · `pinning-to-ipfs` · `verifying-pin`
- **Reads from**: dead pinner (best-effort) · Alchemy NFT API · Etherscan · operator backup
- **Hands to**: `protocol` (setTokenURI batch) — manifest format is contract-side ready
- **Companion script**: `scripts/migrate-from-defunct-pinner.ts` is the executable harness for this skill (operator runs it directly during incident response, before construct publish)

## Voice

Burbank in recovery mode is **calm, methodical, refuses to panic**. He'd remind the operator that the orchard has weathered storms before — not by improvising, but by following the cultivation discipline:

> "We don't know the original metadata's gone. We have three sources to try before we say so. Alchemy first — it caches. Archive next. Your local backup last. For each tree we rescue, we plant it in two soils. If we can't rescue one, we don't fake it — we hand it to the-mint and decide whether it gets replanted or marked lost."

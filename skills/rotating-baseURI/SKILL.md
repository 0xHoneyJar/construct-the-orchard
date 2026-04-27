---
name: rotating-baseURI
description: Rotate a collection's on-chain baseURI from a stale source (defunct pinner, sunset domain, deprecated route) to a new sound source (thj-assets CloudFront, Next.js metadata API, freshly migrated S3 prefix). Pre-flight verifies the new URI resolves end-to-end before any tx; post-flight forces marketplace re-index. Companion to migrating-storage.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Rotating baseURI

The cutover skill. After `migrating-storage` populates the new substrate, **rotating-baseURI is the single on-chain action** that switches a live collection's metadata pointer from the defunct source to the new one. It's the moment the orchard takes ownership of a tree that used to grow on someone else's land.

Most NFT contracts (Mibera + all FRACTURED variants + Candies + Tarot + VM/Mishadows + GIF) use the `setBaseURI(uri)` pattern — a single URI prefix concatenated with the tokenId at resolve-time. **Per-token metadata mutation does NOT require this skill** — it's a file write at `{baseURI}{tokenId}`. This skill is invoked when the *prefix itself* needs to change (post-migration cutover, vendor swap, pinner death).

> *"Don't graft onto rotten root stock. The new soil has to bear weight before you transplant the tree."* — Burbank-paraphrased; see `identity/LUTHER_BURBANK.md`

## When to use

- After `migrating-storage` produced new URIs and the new metadata is *resolvable* end-to-end (CDN responds, JSON parses, image URLs resolve)
- A pinner under a live collection has gone defunct (mibera-shape) and operator wants to cut over to operator-controlled storage
- Migrating from a deprecated metadata route to a canonical one (e.g., consolidating `/api/v1/gif/` and `/api/v2/gif/` to `/api/gif/`)
- One-time rotation when standing up a new collection's serving topology

## When NOT to use

- The metadata file at the *current* baseURI is correct — the substrate just needs re-pinning. Use `tending-storage` + `migrating-storage` instead. Don't rotate the prefix if the prefix is right.
- Per-token graft (changing one token's traits). Under setBaseURI pattern, that's a file write at the existing path. No contract call needed.
- The contract uses per-token `setTokenURI(id, uri)` instead of collection-wide `setBaseURI(uri)`. That's a different cutover shape — batch many tx, not one. Cross-reference the contract's source to confirm pattern before invoking.
- Lock has been called — some contracts (e.g., EvolvableArchetype's `lockBaseUriForever()`) make rotation impossible after lock. Refuse if `baseUriLocked` is true.

## Workflow

1. **Confirm pattern.** Read the contract source or call `_baseURI()` (if exposed) / probe `tokenURI(1)` and verify the response shape matches `{prefix}{tokenId}`. If it's a per-token URI scheme, refuse and route to a different cutover skill.

2. **Pre-flight the new URI end-to-end.**
   - For each tokenId in a representative sample (suggested: 1, max/2, max), construct `{newBaseURI}{tokenId}` and resolve it
   - Confirm: HTTP 200, content-type `application/json`, JSON parses, contains required ERC-721/ERC-1155 fields (`name`, `description`, `image`)
   - Confirm: the `image` field URL also resolves (HEAD request, 200, content-type image/*)
   - Confirm: hash of resolved JSON matches the manifest from `migrating-storage` (if integrated)
   - **Refuse to advance to step 3 if pre-flight fails on any sample**. Surface a Verdict (severity high) listing failed tokens.

3. **Compose the rotation manifest.**

   ```yaml
   # grimoires/{product}/cultivations/{collection}/rotate-{date}.plan.yaml
   contract:
     name: <collection-slug>
     address: 0x...
     chain: berachain
     pattern: setBaseURI(string)  # or setBaseUri (case variants exist — Tarot uses setBaseUri)
     authority: onlyOwner          # or specific role
   current_baseURI: <resolve via tokenURI(1) - tokenId substring>
   proposed_baseURI: <new prefix>
   preflight:
     samples_tested: [1, 5000, 10000]
     samples_passed: [1, 5000, 10000]
     samples_failed: []
   risk:
     ttl_burst: <CloudFront TTL on metadata path; if 1yr, slow refresh>
     marketplace_lag_estimate: <minutes-to-hours>
     rollback_uri: <current_baseURI>  # always preserve for rollback
   ```

4. **Hand off to operator (or to protocol when delegated).** Output the cast/foundry command:

   ```bash
   cast send --rpc-url $RPC --private-key $OWNER_KEY \
     <CONTRACT_ADDRESS> "setBaseURI(string)" "<NEW_BASE_URI>"
   ```

   `rotating-baseURI` does NOT execute the tx itself — that's `protocol`'s domain (or operator wallet). The skill prepares the manifest + command + simulation.

5. **Post-flight: invalidate caches, force re-index.**
   - CloudFront: invalidate `/{collection-prefix}/*` (e.g., `/Mibera/metadata/*`)
   - Cache headers: confirm `Cache-Control: public, max-age=3600` (1hr) on metadata, not 1yr — metadata is mutable; 1yr cache prevents post-rotation refresh
   - Marketplace force-refresh: emit a Signal `the-orchard.rotation.committed` containing `{contract, newBaseURI, timestamp}` so downstream can call OpenSea/marketplace refresh APIs
   - For Mibera-pattern contracts (with `triggerBatchMetadataUpdate()`): emit the on-chain `BatchMetadataUpdate(0, type(uint256).max)` event so EIP-4906-aware indexers re-fetch

6. **Verify the rotation landed.**
   - Re-read on-chain `tokenURI(1)`; confirm it now returns `{newBaseURI}1`
   - Resolve the new tokenURI; confirm content matches expected
   - Surface a Verdict (info if all green, medium if partial, high if rotation didn't take)

7. **Append to mutation log.** This rotation is a graft of the substrate itself; record it in `grimoires/{product}/mutations/{collection}.yaml` with `mutation_type: baseURI_rotation`. The history is sacred; future tending knows when the substrate moved.

## Output shape

```yaml
# grimoires/{product}/cultivations/{collection}/rotate-{date}.result.yaml
contract: <address>
collection: <name>
rotated_at: <ISO date>
old_baseURI: <prior prefix>
new_baseURI: <new prefix>
tx_hash: 0x...
block_number: <int>
preflight:
  sample_count: <int>
  sample_pass_rate: 100% | <%>
postflight:
  cloudfront_invalidation_id: <if applicable>
  marketplaces_notified: [opensea, magiceden, ...]
  on_chain_event_emitted: BatchMetadataUpdate | none
verification:
  tokenURI_returns_new_prefix: true | false
  resolved_metadata_matches: true | false
  severity: info | medium | high
mutation_log_entry: <ref into mutations/{collection}.yaml>
```

## Anti-patterns

- **Rotating without pre-flight.** A baseURI pointing at a 404 is worse than a baseURI pointing at a dead pinner — at least the dead pinner has cached responses on indexers; a 404 is fresh broken. **Always sample-test before tx**.
- **Skipping rollback prep.** The operator may need to revert. Always record `current_baseURI` as `rollback_uri` in the manifest. Don't trust the chain to remember it; chain remembers post-tx.
- **Ignoring CloudFront cache TTL.** A 1-year cache TTL on metadata + a baseURI rotation = stale metadata for 1 year. Verify Cache-Control on the new path is metadata-appropriate (1hr or no-cache during reveal periods) BEFORE rotating.
- **Forgetting BatchMetadataUpdate event.** EIP-4906 lets indexers know to re-fetch. Mibera contracts have `triggerBatchMetadataUpdate()` for this reason. Emit it after rotation OR rely on `setBaseURI` to emit it (Mibera does; FRACTURED does not — variant-specific behavior matters).
- **Rotating mid-graft cycle.** If `cultivating-cycle` is open and `grafting-traits` is mid-stream, rotation will invalidate the cycle's URI assumptions. Refuse if a cycle is `status: active` unless explicitly forced.
- **Auto-executing the contract call.** This skill prepares; `protocol` (or operator wallet) executes. Boundary holds — the orchard never writes contracts unilaterally.

## Composes with

- **Upstream**: `migrating-storage` (produces the new substrate this skill rotates *to*) · operator decision · `tending-storage` (which surfaced the original drift)
- **Pre-flight calls**: HTTP HEAD/GET to verify resolution · `verifying-pin` (substrate health check on the new URI prefix's content)
- **Hands to**: `protocol` (cast send / Defender / Safe-module execution) for the actual contract write
- **Post-flight calls**: `verifying-mutation` (reads on-chain tokenURI to confirm rotation landed) · `herald` (announcement composition if rotation is operator-visible)
- **Companion**: `cultivating-cycle` consumes the rotation as a cycle event; `retrospecting-cycle` documents it

## Voice

Burbank doing a substrate transplant is **methodical, never panicked, refuses to leave the old path until the new one is verified bearing weight**. The orchard has weathered worse:

> "We tested the new soil before we lifted the trees. Tokens 1, 5000, and 10000 all resolved through the new path; their content matches the manifest from the migration. The rollback path is recorded. The contract call is composed. You're the one who signs — I just hold the cuttings until you say go. Once it's on-chain, I invalidate the CDN, emit the batch-update event, and verify the chain reflects the new prefix. If anything misses, we hold the old soil ready until we know the new soil holds."

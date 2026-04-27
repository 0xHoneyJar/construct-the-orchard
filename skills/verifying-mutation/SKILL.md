---
name: verifying-mutation
description: Confirm a graft landed both on-chain and on the pinner. Reads tokenURI from the contract, resolves it, hashes the result, and confirms it matches the mutation-log entry. Read-only Verdict emitter.
user-invocable: true
allowed-tools: Read, Bash
---

# Verifying Mutation

Trust-but-verify for grafts. After `protocol` commits the `setTokenURI` call, this skill confirms the contract update succeeded AND the new URI resolves AND the resolved content matches the new pin. Detects partial-graft failures (contract committed but pin lost; pin landed but contract un-updated).

## When to use

- Immediately after a `protocol` setTokenURI batch lands
- During recurring `tending-storage` passes for tokens that have mutation history
- Before announcing a graft (don't broadcast a graft that's broken)

## When NOT to use

- The pin alone needs verifying (no mutation context) — that's `verifying-pin`
- The token has no mutation history — skip; nothing to verify

## Workflow

1. Read the latest mutation-log entry for the token from `mutations/{collection}.yaml`.
2. Read the on-chain `tokenURI` for the token via `protocol`'s read interface.
3. Compare on-chain URI to the mutation log's recorded `new_uri`. Mismatch = graft incomplete.
4. Resolve the on-chain URI; hash the JSON; compare to the mutation log's `new_metadata_hash`.
5. Resolve the JSON's `image:` field; hash the image bytes; compare to mutation log's `new_image_cid` (or hash if non-IPFS).
6. Emit a Verdict with severity per match outcome.

## Output shape

```typescript
interface VerifyMutationResult {
  tokenId: number
  graft_id: string
  on_chain_uri_matches: boolean
  metadata_hash_matches: boolean
  image_hash_matches: boolean
  severity: 'info' | 'medium' | 'high'
  notes: string
}
```

## Anti-patterns

- **Trusting the contract event alone.** A `setTokenURI` event in the mempool isn't the same as a confirmed token state — read storage, not events.
- **Skipping image hash verification.** Metadata can match while the image diverges (same JSON, image swap silently). Verify both.
- **Auto-rolling-back on mismatch.** Verifying-mutation reports; rollback is operator + `grafting-traits` re-issue. Read-only.

## Composes with

- **Called by**: `grafting-traits` (post-graft) · `tending-storage` (recurring) · `cultivating-cycle` (cycle close)
- **Reads from**: `protocol` (contract state) · pinners (URI resolution) · `mutations/{collection}.yaml`

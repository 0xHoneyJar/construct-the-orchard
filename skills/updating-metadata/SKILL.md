---
name: updating-metadata
description: Edit a token's JSON metadata in-place — attribute swap, name correction, description update — and re-pin under dual-pin policy. JSON-only specialization of grafting-traits.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Updating Metadata

Specialized op called by `grafting-traits` for changes that touch only the JSON, not the image. Faster path than full graft (no image regeneration), but follows the same dual-pin + mutation-log discipline.

## When to use

- Trait attribute correction (typo, wrong value, schema migration)
- Name or description field update (community-input proposal, lore expansion)
- `external_url` or `animation_url` change

## When NOT to use

- The image needs to change too — that's `updating-image` or full `grafting-traits`
- The change requires regenerating the asset — `the-mint`
- The metadata schema itself is changing — that's a collection-wide event, escalate to `cultivating-cycle`

## Workflow

1. Read current metadata via `verifying-pin`. Refuse if substrate is unhealthy.
2. Apply the change-spec to the JSON.
3. Re-hash; confirm the change actually mutated the bytes (operator-error guard).
4. Dual-pin via `pinning-to-freeside` + `pinning-to-ipfs`.
5. Hand to `grafting-traits` for the mutation log + protocol handoff.

## Output shape

```typescript
interface MetadataUpdateResult {
  tokenId: number
  old_hash: string
  new_hash: string
  diff: Record<string, {from: any, to: any}>
  new_freeside_url: string
  new_ipfs_cid: string
}
```

## Anti-patterns

- **Editing without diffing.** Always log the field-level diff. "Metadata updated" with no diff is a black-box change.
- **Skipping image-hash check.** If the JSON's `image:` field references a CID that no longer matches the actual image bytes, the metadata is broken even though it pinned cleanly. Validate.
- **Treating updating-metadata as a non-graft.** It's still a graft. Mutation log entry is mandatory.

## Composes with

- **Called by**: `grafting-traits`
- **Calls**: `verifying-pin` · `pinning-to-freeside` · `pinning-to-ipfs`
- **Hands to**: `grafting-traits` for log + protocol handoff

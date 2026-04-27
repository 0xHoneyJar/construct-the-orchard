---
name: updating-image
description: Replace a token's image — composes with the-mint when regeneration is needed — re-pin both image and metadata, update the metadata's image-hash reference. Image specialization of grafting-traits.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Updating Image

Specialized op called by `grafting-traits` when the image (or asset) changes. Image change always implies metadata change (the `image:` URL/CID updates), so this skill writes both pins.

## When to use

- Visual trait swap (background, body, accessory) requires new image
- Original asset rendering was broken on launch and needs replacement
- `the-mint` regenerated the asset (e.g. after a trait swap requested by community input)

## When NOT to use

- JSON-only change — `updating-metadata`
- Wholesale collection re-render — `the-mint` cycle, escalate to `cultivating-cycle`

## Workflow

1. Read current pin state via `verifying-pin`. Refuse on unhealthy substrate.
2. Receive new image (path, buffer, or `the-mint`-emitted artifact reference).
3. Re-pin image: `pinning-to-freeside` for the image bytes; `pinning-to-ipfs` for the same. Both return URIs/CIDs.
4. Update the metadata JSON's `image:` field to the new IPFS CID (canonical) and `image_url:`/`external_url:` to the Freeside URL where the schema expects it.
5. Re-pin the updated metadata via both vendors.
6. Hand to `grafting-traits` for the mutation log + protocol handoff.

## Output shape

```typescript
interface ImageUpdateResult {
  tokenId: number
  old_image_cid: string
  new_image_cid: string
  old_metadata_hash: string
  new_metadata_hash: string
  new_freeside_metadata_url: string
  regenerated_via: 'the-mint' | 'operator-supplied'
}
```

## Anti-patterns

- **Image-only repin (forgetting metadata).** The metadata's `image:` field still points at the old image. The token now references stale art. Always re-pin both.
- **Trusting `the-mint`'s emitted artifact without verification.** Hash the bytes received against `the-mint`'s declared output hash. If mismatch, refuse and surface.
- **Pinning and then composing the metadata.** Wrong order. Compose first (the metadata needs the new image URL), then pin the metadata. Otherwise you pin a metadata file that doesn't reference the new image.

## Composes with

- **Called by**: `grafting-traits`
- **Composes with**: `the-mint` (image regeneration) · `pinning-to-freeside` · `pinning-to-ipfs` · `verifying-pin`
- **Hands to**: `grafting-traits` for log + protocol handoff

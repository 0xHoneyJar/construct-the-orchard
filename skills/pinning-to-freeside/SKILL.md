---
name: pinning-to-freeside
description: Upload metadata JSON and image assets to Freeside (Honey Jar's own infra) and return immutable URIs. Vendor implementation for the primary pin under the dual-pin policy.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Pinning to Freeside

Vendor implementation for the **primary** pin in the-orchard's dual-pin policy. Freeside is Honey Jar's own infrastructure — operator hint per seed proposal: this is the soil, not a vendor. Freeside-first because we control the operational continuity (mibera incident lesson: external services go down).

## Trigger

```
/tend storage --pin freeside <token-id>
"pin to freeside"
"upload to honeyjar infra"
```

## When to use

- Called by `tending-storage` during a dual-pin pass (default path)
- Called by `migrating-storage` when lifting tokens off a defunct external service
- One-shot pin requested by operator (rare — usually you want the orchestrated pass)

## When NOT to use

- Freeside endpoint is not configured (`FREESIDE_API_URL` env unset) — refuse, surface configuration gap
- Token does not yet exist on-chain — `the-mint` + `protocol` first, then tend
- Operator wants IPFS-only — sibling `pinning-to-ipfs`

## Workflow

1. **Validate input.** Required: `tokenId`, `collection`, `metadata` (JSON), `image` (path or buffer). Optional: `imageHash` (sha256, computed if omitted).

2. **Authenticate.** Read `FREESIDE_API_KEY` from env. If missing, refuse and emit a configuration Verdict (severity: high, blocks the dual-pin pass).

3. **Upload image first.** POST image to `${FREESIDE_API_URL}/upload` with `Content-Type: application/octet-stream` and `X-Freeside-Path: collections/{collection}/images/{tokenId}.{ext}`. Receive `{ url, hash }`. Verify `hash` matches local `imageHash`.

4. **Substitute image URL into metadata.** Replace any placeholder `image:` field in the metadata JSON with the freeside URL from step 3.

5. **Upload metadata.** POST metadata to `${FREESIDE_API_URL}/upload` with `Content-Type: application/json` and `X-Freeside-Path: collections/{collection}/metadata/{tokenId}.json`. Receive `{ url, hash }`.

6. **Return URI.** The returned `url` is the freeside metadata URL — what gets recorded in `pins/{collection}.yaml` as `freeside_url` and (eventually) becomes the token's on-chain `tokenURI` after a `protocol` call.

## Output shape

```typescript
interface FreesidePinResult {
  tokenId: number
  collection: string
  freeside_url: string         // public resolution URL
  metadata_hash: string        // sha256 of the JSON
  image_url: string
  image_hash: string
  pinned_at: string            // ISO date
}
```

## Anti-patterns

- **Trusting the upload response without hash verification.** A successful HTTP 200 means the request landed; hash verification means the bytes match. Always verify.
- **Pinning the metadata before the image.** Metadata references the image URL. If you pin metadata first, the image URL is a placeholder — the metadata is then immediately stale. Image first, always.
- **Hardcoding `https://freeside.honeyjar.io/...` URLs.** Environment-configured (`FREESIDE_API_URL`). Honey Jar may stand up regional or production-vs-staging endpoints later.
- **Treating Freeside like a vendor.** It's the soil. Don't speak about it like AWS S3 in operator-facing output.

## Composes with

- **Called by**: `tending-storage` (orchestrator) · `migrating-storage` (recovery path) · `updating-metadata` and `updating-image` (graft re-pin)
- **Sibling**: `pinning-to-ipfs` (the dual-pin partner; both run for every pinnable token)
- **Validates with**: `verifying-pin` runs after to confirm resolution

## Voice

Direct, terse, hash-aware. Burbank's voice through this skill is the cultivator confirming the soil amendment landed: "Image up, hash matches. Metadata up, hash matches. Freeside has it. Now IPFS."

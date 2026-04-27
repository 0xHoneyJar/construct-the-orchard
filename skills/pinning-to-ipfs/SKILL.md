---
name: pinning-to-ipfs
description: Pin metadata + image to IPFS via the configured pinner (Pinata, nft.storage, web3.storage, or self-hosted). Vendor implementation for the fallback pin under the dual-pin policy. Decentralized survival layer.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Pinning to IPFS

Vendor implementation for the **fallback** pin in the-orchard's dual-pin policy. IPFS exists alongside Freeside, not as a substitute — if Freeside ever goes the way the mibera service did, IPFS keeps the collection resolvable on any public gateway.

## Trigger

```
/tend storage --pin ipfs <token-id>
"pin to ipfs"
"backup pin"
"fallback pin"
```

## When to use

- Called by `tending-storage` during the dual-pin pass (always, alongside Freeside)
- Called by `migrating-storage` for the IPFS leg of recovery
- Disaster-prep one-shot pin when Freeside is degraded but IPFS is healthy

## When NOT to use

- IPFS pinner is not configured — refuse with configuration Verdict (high severity, blocks dual-pin)
- Token doesn't exist on-chain yet
- Freeside-only pin requested (operator override; rare and discouraged)

## Workflow

1. **Validate input.** Same as `pinning-to-freeside`: tokenId, collection, metadata, image.

2. **Resolve pinner backend.** Read `IPFS_PINNER` env: one of `pinata`, `nft-storage`, `web3-storage`, `lighthouse`, `self-hosted`. Each has a different SDK; the skill dispatches to the configured backend.

3. **Authenticate.** Backend-specific API key from env (`PINATA_JWT`, `NFT_STORAGE_TOKEN`, etc.).

4. **Upload image.** Pin the image bytes; receive a CID. Verify the CID is reachable via at least 2 of: `ipfs.io`, `cloudflare-ipfs.com`, `dweb.link`, `gateway.pinata.cloud`.

5. **Substitute image CID into metadata.** Set `image:` in the JSON to `ipfs://{imageCid}` (canonical form; gateways resolve this consistently).

6. **Upload metadata.** Pin the JSON; receive a metadata CID.

7. **Return URI.** `ipfs://{metadataCid}` is the canonical IPFS URI for this token. Recorded in `pins/{collection}.yaml` as `ipfs_cid`.

## Output shape

```typescript
interface IpfsPinResult {
  tokenId: number
  collection: string
  ipfs_cid: string             // metadata CID
  ipfs_uri: string             // ipfs://{cid}
  image_cid: string
  pinner_backend: 'pinata' | 'nft-storage' | 'web3-storage' | 'lighthouse' | 'self-hosted'
  gateways_verified: string[]  // at least 2
  pinned_at: string
}
```

## Anti-patterns

- **Single-gateway verification.** A CID that resolves on `ipfs.io` but nowhere else may be sitting on one node about to expire. Always verify on at least 2 gateways.
- **Confusing CID v0 / v1.** Stick with v1 CIDs (`bafy...`). Some pinners default to v0 (`Qm...`) — convert or configure for v1.
- **Pinata-only assumptions.** The skill must support the backend rotation. Honey Jar may migrate IPFS pinners (e.g., off Pinata when costs change) without forcing a construct rewrite.
- **Re-pinning unchanged content.** IPFS is content-addressed — same bytes produce the same CID. Don't pay for a re-pin if the content is identical; check the manifest first.

## Composes with

- **Called by**: `tending-storage` · `migrating-storage` · `updating-metadata`/`updating-image` for graft re-pins
- **Sibling**: `pinning-to-freeside` (primary pin partner)
- **Validates with**: `verifying-pin` (which probes 2+ gateways)

## Voice

Burbank's voice through IPFS pinning recognizes that decentralization is *insurance*: "Freeside is the orchard's soil. IPFS is the seed bank — if the soil ever fails, the seeds survive. We pin both because losing one shouldn't lose the collection."

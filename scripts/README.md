# scripts/

Executable tools for the-orchard. Operators run these directly during
cultivation work; agents discover them via `MANIFEST.yaml`.

## Stopgap tools

These are stopgap-form executables. The construct's eventual SKILL.md pipelines
(`migrating-storage`, `tending-storage`, etc.) replace them — but until those
land, the operator runs the scripts directly.

| Script | Purpose | Skill it stands in for |
|---|---|---|
| `migrate-from-defunct-pinner.ts` | Lift a collection's metadata + images off a dead pinner onto Freeside (thj-assets S3) + IPFS dual-pin. The construct's first cultivation event — built for the mibera Irys incident 2026-04-27. | `migrating-storage` |

See `MANIFEST.yaml` for the agent-readable schema (args, output, credentials,
side effects, danger level).

## Setup

The TypeScript scripts have a small set of runtime deps. Install them in this
directory once before first run:

```bash
cd scripts/
npm install --save-exact yaml @aws-sdk/client-s3
# OR if the operator prefers pnpm:
pnpm add -E yaml @aws-sdk/client-s3
```

Other ecosystem deps the script imports as needed (lazy-loaded so they don't
block when not used):

- `@aws-sdk/client-s3` — when uploading to thj-assets (skipped in `--dry-run`)

The script uses Node built-in `fetch` (Node 18+) for HTTP; no extra fetch lib
needed. Node 20+ recommended for stable `parseArgs` and `node:fs/promises`.

## Required environment

See per-script `MANIFEST.yaml` `credentials:` block for the canonical list. For
`migrate-from-defunct-pinner.ts` the operator needs:

```bash
export ALCHEMY_API_KEY="..."                 # fallback metadata source
export AWS_ACCESS_KEY_ID_VM="..."            # thj-assets S3 access
export AWS_SECRET_ACCESS_KEY_VM="..."        # thj-assets S3 secret
export AWS_REGION="us-east-1"                # default; override per region
export THJ_ASSETS_BUCKET="thj-assets"        # default; override if migrating to a different bucket
export THJ_CDN_BASE="https://d163aeqznbc6js.cloudfront.net"  # default

# Only when --ipfs-pinner=pinata
export PINATA_JWT="..."
```

## Running migrate-from-defunct-pinner

Author a manifest YAML (see `manifests/mibera-fractured.example.yaml`).
Then run:

```bash
# dry-run — see what would migrate without uploading
npx tsx migrate-from-defunct-pinner.ts \
  --manifest manifests/mibera-fractured.example.yaml \
  --output ./out/mibera-fractured.dryrun.yaml \
  --dry-run

# real migration — single-pin (Freeside only)
npx tsx migrate-from-defunct-pinner.ts \
  --manifest manifests/mibera-fractured.example.yaml \
  --output ./out/mibera-fractured.result.yaml \
  --concurrency 4

# real migration — dual-pin (Freeside + IPFS via Pinata)
npx tsx migrate-from-defunct-pinner.ts \
  --manifest manifests/mibera-fractured.example.yaml \
  --output ./out/mibera-fractured.result.yaml \
  --concurrency 4 \
  --ipfs-pinner pinata
```

The output YAML is the artifact the operator hands to `protocol` for
`setTokenURI` batch calls. Inspect `ready_for_setTokenURI: true` before
proceeding to the contract layer.

## Architecture note (recon 2026-04-27)

"Freeside" in operator vocabulary maps today to the existing `thj-assets` S3
bucket + CloudFront CDN. Freeside proper is billing/settlement infra; metadata
hosting is S3. The script targets the operationally-real backend. If a true
Freeside metadata API lands later, swap the `ThjAssetsClient` impl in the
script — the `FreesideClient` interface is preserved.

### Single-pin reality for 0xHoneyJar (BRIDGEBUILD diagnostic 2026-04-27)

The construct's design declares "dual-pin policy" (Freeside primary + IPFS
fallback). The 0xHoneyJar org's actual reality:

- ✅ thj-assets S3 + CloudFront — operationally real, primary
- ❌ IPFS write integration — **none**. Pinata, web3.storage, nft.storage,
  lighthouse: zero org repos have write integration. Only gateway *reads*.

So in practice, `--ipfs-pinner` is unset for the org's runs and the migration
operates in single-pin mode (Freeside-shape only). This is acceptable because:

1. Alchemy CDN holds a parallel image cache for every token
   (`https://nft-cdn.alchemy.com/{network}/{hash}`) — de-facto secondary
2. The mibera incident demonstrated Irys (decentralized) failed first;
   centralized infra (Alchemy + thj-assets) survived. Decentralization isn't
   the right mitigation here.
3. Multi-region thj-assets replication (us-west-2 → us-east-1) is a more
   actionable insurance policy than IPFS pinning.

Future cycle should commit to one of:
  (a) Pin to Pinata — bring up first IPFS-write integration in 0xHoneyJar
  (b) Replicate thj-assets to a second region/account — sovereign fallback
  (c) Document single-pin + Alchemy-CDN as the policy

Tracked in `grimoires/loa/proposals/storage-architecture-diagnostic.md` Q5.

## Mibera mainnet incident (2026-04-27 active)

The MAIN Mibera contract (`0x6666397DFe9a8c469BF65dc744CB1C733416c420`) on
Berachain has 10k holders, all currently broken. Its baseURI points at the
defunct Irys mutable txn `6MqM65yemqQpjVe4rCGxEJfsVA4dJszFhL3suzPGzH56`.

**Recovery is straightforward**:
1. Run `migrate-from-defunct-pinner.ts` with `manifests/mibera-main.example.yaml`
2. Operator signs ONE `setBaseURI` tx pointing Mibera at the new CDN prefix
3. CloudFront invalidate; marketplaces re-index

Full plan: `grimoires/loa/cultivations/mibera/cutover-plan.md` (in
micodex-studio's grimoires).

The FRACTURED V1-V10 contracts are deployed but **unminted** (verified on-chain
2026-04-27: totalSupply reverts with `OwnerQueryForNonexistentToken`). They
have no live tokens to break and are NOT part of this incident response.

## Construct mapping

| Script piece | Maps to construct skill |
|---|---|
| `recoverFromIrysDirect / Alchemy / Backup` | input layer of `migrating-storage` |
| `ThjAssetsClient` | future `pinning-to-freeside` impl (vendor-agnostic interface) |
| `PinataClient` | one impl of `pinning-to-ipfs` (others: nft-storage, web3-storage, lighthouse) |
| `migrateToken` orchestration | `migrating-storage` skill body |
| Output manifest | `cultivations/migrate-{collection}.result.yaml` artifact |

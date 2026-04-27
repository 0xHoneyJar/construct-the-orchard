---
name: staging-recovery
description: Recover metadata from a defunct or unreliable source (dead Irys gateway, unreachable IPFS CIDs, sunset vendor) and stage it at a new healthy endpoint ready for rotation. The data-side companion to rotating-baseURI.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Staging Recovery

The data layer of a defunct-pinner migration. `migrating-storage` finds the original data; `staging-recovery` lands it at the operator's chosen new endpoint (typically Postgres + an API route in their own infra) and verifies it serves cleanly. Hands off to `rotating-baseURI` for the on-chain commit.

Distinct from `migrating-storage` because the latter is the recovery operation in the abstract; this skill is opinionated about the operator-facing infra: it stages into Postgres-backed API routes, not just S3 dual-pin. For Honey Jar's actual production reality (mibera-honeyroad's `quiz_metadata` / `gif_metadata` Drizzle tables + `/api/{collection}/[tokenId]/route.ts` pattern), this is the canonical staging path.

## When to use

- A defunct-pinner incident has been declared (mibera-shape: dead Irys, unreachable IPFS, sunset external service)
- A planned migration off a vendor (cost / governance / control)
- Bringing a new collection under the operator's own metadata-serving infra (e.g., a partner project that previously self-hosted)

## When NOT to use

- The metadata source is healthy and the work is per-token cosmetic — that's `grafting-traits`
- The work is purely substrate health (re-pinning at the same endpoint) — that's `tending-storage`
- The operator wants direct S3 dual-pin without a Postgres/API layer — use `pinning-to-freeside` + `pinning-to-ipfs` directly; this skill assumes the API-mediated layer

## Workflow

1. **Define the staging target.** Operator declares the new endpoint pattern: e.g., `https://www.honeyroad.xyz/api/{collection}/{tokenId}`. The skill confirms the corresponding API route exists in source (e.g., `mibera-honeyroad/app/api/{collection}/[tokenId]/route.ts`). If the route doesn't exist yet, surface as a gap: this skill stages data; operator's app team builds the route.

2. **Identify the persistence layer.** For Honey Jar today: Postgres via Drizzle, with a per-collection metadata table (e.g., `mibera_metadata`, `fractured_v1_metadata`) or a unified `nft_metadata` table keyed by `(collection, tokenid)`. Confirm the schema exists or surface a Drizzle migration request.

3. **Recover the metadata.** Call into `migrating-storage` for the heavy lift: per-token, attempt original source → Alchemy NFT API cache → operator backup → operator-supplied Pinata/IPFS account → regenerate from layer composition. Each token gets an outcome row.

4. **Validate per-token JSON shape.** Each recovered metadata blob must satisfy the operator's metadata schema (typically: `name`, `description`, `image`, `attributes[]`). Image URLs must reference operator-controlled CDN (`d163aeqznbc6js.cloudfront.net`, `assets.mibera.io`) or be IPFS CIDs the operator has re-pinned. **Refuse to stage** entries with broken image references; surface for operator decision (regenerate / mark unrecoverable / accept-as-is).

5. **Bulk-load into Postgres.** Generate the Drizzle/SQL bulk-insert commands. Use ON CONFLICT DO UPDATE so the staging is idempotent (re-runs converge). Alternative for very large collections: emit a JSONL artifact and let the operator's Drizzle migration consume it.

6. **Smoke-test the served endpoint.** Hit `https://staging.{operator-domain}/api/{collection}/{tokenId}` for ≥10 randomly sampled tokenIds. Confirm HTTP 200, valid JSON, schema match, image resolves.

7. **Emit the staging report.** `cultivations/{collection}/stage-{cycle}.yaml` with: token count recovered, fallback source per token, shape validation passed/failed, smoke-test results, outstanding gaps. This artifact is what `rotating-baseURI` consumes as proof-of-readiness.

## Output shape

```yaml
# grimoires/{product}/cultivations/{collection}/stage-{cycle}.yaml
collection: <name>
contract: 0x...
cycle_id: stage-{collection}-{YYYY-MM-DD}
authored_by: the-orchard/staging-recovery
authored_at: <ISO date>

# Target — where staged data will live + serve
target_endpoint: "https://www.honeyroad.xyz/api/{collection}/{tokenId}"
target_persistence: "postgres://honeyroad/{collection}_metadata via Drizzle"
target_route_file: "mibera-honeyroad/app/api/{collection}/[tokenId]/route.ts"
target_route_exists: true | false  # if false, gap surfaced for app team

# Recovery outcomes
tokens_attempted: 1000
tokens_recovered: 992
tokens_unrecoverable: 8        # routed to operator + the-mint
fallback_source_breakdown:
  irys_direct: 200
  alchemy_cache: 600
  operator_backup: 192
  regenerated: 0
  unrecoverable: 8

# Shape validation
schema_pass: 992
schema_fail: 0
image_url_pass: 992
image_url_fail: 0   # entries with broken image references — must be 0 to advance to rotation

# Bulk-load
bulk_insert_artifact: ".out/{collection}-staging.sql"   # SQL file the operator runs
bulk_insert_dry_run: true   # set false after operator commits the load

# Smoke test (post-load)
smoke_test_url: "https://staging.honeyroad.xyz/api/{collection}/"
smoke_test_samples:
  - tokenId: 100
    http: 200
    schema_match: true
    image_resolved: true
  # ... ≥10 samples

# Hand-off
ready_for_rotation: true | false   # all gates green
rotation_manifest_target: grimoires/{product}/cultivations/{collection}/rotate-{cycle}.yaml
gaps:
  - description: "8 tokens unrecoverable; route to the-mint for replant decision"
    severity: medium
```

## Anti-patterns

- **Staging incomplete data and rotating anyway.** If 8 tokens are unrecoverable, the rotation will produce 8 broken NFTs. Either stage all-or-nothing, or explicitly accept the broken-tokens-list with operator sign-off in the rotation manifest.
- **Reconstructing metadata from imagination.** When original is unrecoverable AND no regeneration path exists, mark as `unrecoverable` and route to operator + `the-mint`. Never invent plausible substitute metadata.
- **Bulk-loading without a backup.** Postgres should snapshot before the bulk load. Drizzle migration discipline applies; staging-recovery doesn't bypass it.
- **Skipping the smoke test.** A successful bulk load doesn't mean the API serves correctly. Smoke test against `staging.{domain}` (or local dev) before declaring `ready_for_rotation: true`.
- **Conflating staging with rotation.** This skill does NOT call setBaseURI. The rotation is `rotating-baseURI`'s job. Boundary preserved — staging is reversible (re-run with corrections); rotation is on-chain irreversible.

## Composes with

- **Upstream**: `migrating-storage` (does the actual recovery per-token) · operator's incident declaration
- **Persistence**: operator's Postgres + Drizzle (e.g., honeyroad's `quiz_metadata` schema as template)
- **Validation**: schema validators + smoke tests
- **Hands to**: `rotating-baseURI` (consumes the staging report as proof of readiness)
- **Logs to**: `cultivations/{collection}/stage-{cycle}.yaml`

## Voice

Burbank moving cuttings to the new orchard nursery before the new soil is ready:

> "We have the cuttings. We have the new beds. We're not transplanting until every cutting roots in the nursery and we've watered all of them once. The orchard waits. The valve doesn't turn until every sapling has shown it can drink from the new line."

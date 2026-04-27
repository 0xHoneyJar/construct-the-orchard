---
name: serving-metadata
description: Documents and validates the canonical 0xHoneyJar metadata-serving substrate — Postgres-row-as-source-of-truth, Next.js dynamic route as the wire boundary, CloudFront-fronted thj-assets for image bytes. The architectural reference; staging-recovery is the operational act that targets it.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Serving metadata

The architectural reference for the orchard's metadata substrate. Three healthy production collections (🃏 Tarot, 🍭 Candies, 🎞️ GIF) prove the pattern; the others are being onboarded to it.

```
contract.tokenURI(id)  ──→  honeyroad.xyz/api/{collection}/{id}     ◄── ROUTE
                              │
                              ├─ reads ─→  Postgres `{collection}_metadata`     ◄── TRUTH
                              │              (row keyed by tokenid, JSONB metadata)
                              │
                              └─ image URL ─→  d163aeqznbc6js.cloudfront.net/...  ◄── CACHE
                                                  │
                                                  └─→  thj-assets S3 (us-west-2)   ◄── BYTES
```

This is not "an" architecture — it's *the* architecture. Documented here so onboarding a new collection is a 4-step recipe, not an invention.

## When to use

- Verifying that a collection (existing or new) follows the canonical pattern
- Auditing a collection's substrate health across all three layers
- Onboarding a new collection — emit the schema migration + route file as scaffolding
- Surfacing drift when a collection deviates (e.g. metadata hosted on IPFS, images on a different CDN)

## When NOT to use

- Per-token graft mutation — that's `grafting-traits` (writes to existing table)
- Active recovery from a defunct source — that's `staging-recovery` (this skill is the *destination shape*; staging-recovery is the *act of getting data there*)
- Bulk image uploads — `pinning-to-freeside` handles bytes; this skill verifies metadata references them correctly

## Workflow — auditing a collection against the pattern

1. **Read the contract's tokenURI shape.** Either via on-chain `tokenURI(sampleId)` (cast / viem) or via storage slot if the function reverts. Confirm the URI is a prefix + tokenId concatenation (setBaseURI pattern).

2. **Confirm the route is alive.** HTTP GET the prefix + sampleIds (1, mid, last). Each must return 200 with valid JSON containing `name`, `image`, `attributes` minimum.

3. **Trace to Postgres.** The route file (e.g. `mibera-honeyroad/app/api/{collection}/[tokenId]/route.ts`) MUST query a Drizzle table. Confirm: schema entry exists (`{collection}Metadata`), table is populated, indexed by `tokenid`.

4. **Trace image URLs to operator-controlled CDN.** Sampled metadata's `image:` field MUST point to `d163aeqznbc6js.cloudfront.net` or `assets.mibera.io` (operator-controlled). **Refuse** image URLs pointing at `ipfs://`, `ar://`, or third-party gateways. Surface as drift; route to `staging-recovery` to fix.

5. **Confirm CDN serves the image.** HEAD request to image URL. Must return 200 with `Cache-Control: public, max-age=31536000` (immutable assets) or `max-age=3600` (mutable metadata).

6. **Emit the audit Verdict.** Per layer (route / Postgres / CDN), report passed/failed. Healthy = all three green.

## Workflow — provisioning a new collection

For onboarding (new collection, or migrating one off fragile substrate):

1. **Author the Drizzle schema entry** in `mibera-honeyroad/lib/db/schema/index.ts`:
   ```typescript
   export const {collection}Metadata = pgTable("{collection}_metadata", {
     id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
     tokenid: integer().unique().notNull(),
     metadata: jsonb().notNull(),
     created_at: timestamp().defaultNow(),
     updated_at: timestamp().defaultNow(),
   }, (t) => [
     index("idx_{collection}_metadata_tokenid").using("btree", t.tokenid.asc()),
   ]);
   ```

2. **Generate + apply Drizzle migration.** Standard mibera-honeyroad workflow.

3. **Author the dynamic route** at `mibera-honeyroad/app/api/{collection}/[tokenId]/route.ts`:
   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   import { db, schema } from "@/lib/db/drizzle";
   import { eq } from "drizzle-orm";

   export async function GET(_req: NextRequest, props: { params: Promise<{ tokenId: string }> }) {
     const { tokenId } = await props.params;
     const result = await db.select()
       .from(schema.{collection}Metadata)
       .where(eq(schema.{collection}Metadata.tokenid, parseInt(tokenId)));
     const data = result[0] ?? null;
     if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
     return NextResponse.json(data.metadata);
   }
   ```

4. **Hand to `staging-recovery`** for population (recover existing data + bulk-load Postgres + smoke-test).

5. **Hand to `rotating-baseURI`** for the on-chain pointer cutover.

## Output shape

```yaml
# grimoires/{product}/serving/{collection}.yaml — audit artifact
collection: <name>
contract_address: 0x...
canonical_pattern: setBaseURI

substrate:
  route:
    expected: https://www.honeyroad.xyz/api/{collection}/[tokenId]
    actual: <on-chain prefix>
    matches: true | false
    sample_responses: [{tokenId: 1, status: 200, hash: ...}, ...]
  postgres:
    table: {collection}_metadata
    schema_entry: lib/db/schema/index.ts:LINE
    row_count: 10000
    populated: true | false
  cdn:
    image_prefix: https://d163aeqznbc6js.cloudfront.net/Mibera/...
    sample_image_resolves: true
    cache_control: "public, max-age=31536000, immutable"

drift:
  - layer: route
    issue: "tokenURI returns gateway.irys.xyz/... not honeyroad"
    severity: high
    proposed_fix: "run staging-recovery; rotating-baseURI"

verdict: healthy | degraded | broken
```

## Anti-patterns

- **Mixing storage backends in metadata image URLs.** Some images on CDN, some on IPFS, some on Arweave — three failure modes, three SLAs to track. Pick one (CloudFront), enforce it. Drift surfaces here loud.
- **Forgetting CloudFront invalidation on mutation.** Postgres reflects new data immediately; CDN edge nodes hold stale up to 1h until invalidated. Every graft must trigger invalidation for affected images and any cached metadata.
- **Returning route 500s on missing data.** Return 404. Marketplaces interpret 404 as "no token," 500 as "server broken." Different signals; different downstream behavior.
- **Hardcoding the CDN URL.** Use env-config (`THJ_CDN_BASE`) so the substrate can rotate independently of the route code.
- **Confusing serving-metadata with staging-recovery.** This skill describes the substrate; staging-recovery is the act of preparing data for it. They compose; they aren't substitutes.

## Composes with

- **Reference for**: `staging-recovery` (target shape) · `tending-storage` (substrate health audit) · new-collection onboarding flows
- **Composes with**: `pinning-to-freeside` (image bytes), `rotating-baseURI` (the cutover that points the contract at this substrate), `grafting-traits` (writes mutations into this substrate's Postgres tier)
- **Reference contracts**: 🃏 Tarot (`/api/quiz/[tokenId]`), 🍭 Candies (`/api/metadata/drug/[tokenId]`), 🎞️ GIF (`/api/gif/[tokenId]`) — all three serve as the canonical examples to mirror

## Voice

LUTHER BURBANK speaking through `serving-metadata` is **the orchard's surveyor**. Walks the layers; names what each does; refuses to confuse them.

> "The orchard has three layers under every healthy tree. Postgres holds the seed — every token's metadata is a row, indexed by id. The route is the gardener's hand — pulls a row, formats it, hands it to the marketplace. CloudFront is the orchard's air — caches every leaf at the edge, refreshes when we tell it. None of these layers is fragile alone. The discipline is keeping them in their lanes — Postgres for truth, route for shape, CDN for speed."

The pattern is canonical because it's been proven across three healthy collections (Tarot, Candies, GIF) without rework. Mibera main and FRACTURED V1–V10 are being onboarded to it now.

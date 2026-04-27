---
name: serving-metadata
description: The canonical 0xHoneyJar metadata-serving substrate — Postgres-row-as-source-of-truth, Next.js dynamic route as the wire boundary, CloudFront-fronted thj-assets for image bytes. Documents the pattern + provisions new collections to fit it.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Serving metadata

Every honeyjar collection's `tokenURI` resolves through the same shape:

```
contract.tokenURI(id)  ──→  honeyroad.xyz/api/{collection}/{id}
                              │
                              ├─ reads ─→  Postgres `{collection}_metadata` table
                              │              (row-keyed by tokenid, JSONB metadata)
                              │
                              └─ image URL ─→  d163aeqznbc6js.cloudfront.net/Mibera/...
                                                  │
                                                  └─→  thj-assets S3 (us-west-2)
```

This is the soil the orchard tends. Every existing collection follows it (Tarot, VM_Mishadows, Candies, GIF). New collections joining the orchard provision against this pattern by default.

## When to use

- A new collection is being onboarded to the orchard (post-mint, pre-baseURI-set)
- A collection currently on a fragile substrate (IPFS, dead vendor) is migrating into the canonical pattern
- An existing collection's metadata schema is changing and the route needs updating
- A drift-detection pass found a route returning stale data despite DB updates (CloudFront cache invalidation)

## When NOT to use

- Per-token graft mutation — that's `grafting-traits` (writes to existing table; route already serves)
- Bulk image uploads — that's `pinning-to-freeside` (writes to thj-assets; route reads URLs)
- The contract uses `setTokenURI(id, uri)` per-token (not setBaseURI prefix) — incompatible substrate, route a different way

## Workflow — provisioning a new collection

1. **Author the Drizzle schema entry.** Add to `mibera-honeyroad/lib/db/schema/index.ts`:
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

2. **Generate + apply the Drizzle migration.** Standard mibera-honeyroad workflow.

3. **Author the dynamic route.** New file `mibera-honeyroad/app/api/{collection}/[tokenId]/route.ts`:
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

4. **Validate metadata image URLs.** Every row's `metadata.image` must resolve through CloudFront (`d163aeqznbc6js.cloudfront.net`) or another operator-controlled CDN. **No `ipfs://` or `ar://` schemes** — those break the substrate guarantee.

5. **Set Cache-Control headers.** Default for metadata routes:
   - `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` (1h fresh, 1d stale-OK)
   - Mutates allowed: per-graft DB write + targeted CloudFront invalidation propagates within minutes

6. **Verify route returns valid metadata.** Probe `{1, mid, last}` tokenIds; all must 200 with `name` + `image` + `attributes` (when applicable).

7. **Hand to `rotating-baseURI`** for the on-chain pointer rotation if this is a migration/cutover.

## Workflow — onboarding existing data

For collections that already have metadata on another substrate (IPFS, Irys, ad-hoc S3):

1. Run `recovering-metadata` to pull existing metadata into a local manifest
2. Re-point each metadata's `image:` field to the canonical CDN path (replace ipfs:// or ar:// with cloudfront URLs)
3. Bulk-insert into the new Drizzle table
4. Verify route serves expected content
5. Hand to `rotating-baseURI` for the cutover

## Output shape

The skill emits an artifact describing the provisioned substrate:

```yaml
# grimoires/{product}/serving/{collection}.yaml
collection: <name>
contract_address: 0x...
db_table: {collection}_metadata
db_row_count: 10000
api_route: /api/{collection}/[tokenId]
public_url_prefix: https://www.honeyroad.xyz/api/{collection}/
image_cdn_prefix: https://d163aeqznbc6js.cloudfront.net/Mibera/{path}/
sample_verifications:
  - tokenId: 1
    http_status: 200
    has_name: true
    has_image: true
    image_resolves: true
provisioned_at: <ISO>
```

## Anti-patterns

- **Mixing storage backends in metadata image URLs.** Some images on CDN, some on IPFS, some on Arweave = three failure modes. Pick one (CloudFront), enforce it.
- **Forgetting to invalidate CloudFront on mutation.** Route serves new data immediately, but CDN edge nodes hold stale for up to 1h until invalidated. Every graft must trigger invalidation for the affected token's image (and metadata if cached at edge).
- **Returning route 500s on missing data.** Return 404 — marketplaces interpret 404 as "this token doesn't exist," 500 as "server is broken." Different signals.
- **Hardcoding the CDN URL.** Use env-config (`THJ_CDN_BASE`) so the substrate can rotate independently of the route code.
- **Over-formatting in the route.** Some honeyroad routes (e.g. quiz/[tokenId]) reformat attributes (lowercase, etc.) — that's a per-collection concern. The default route is straight passthrough; reformatting is opt-in.

## Composes with

- **Upstream**: `recovering-metadata` (populates the table) · `pinning-to-freeside` (uploads images that metadata references)
- **Downstream**: `rotating-baseURI` (cuts the contract over to this route) · `grafting-traits` (writes to this table for per-token mutations) · `verifying-mutation` (reads from this route to confirm graft landing)
- **Lateral**: `cultivating-cycle` (cycle plans reference which collections are on this substrate)

## Voice

This skill is the *substrate vocabulary* of the orchard. Burbank's voice describes it as:

> "The soil is layered. Postgres holds the seeds — every token's metadata is a row, indexed by id. The route is the gardener's hand — pulls a row, formats it, hands it to the marketplace. CloudFront is the orchard's air — caches every leaf at the edge, refreshes when we tell it. None of these layers is fragile alone. The orchard's discipline is keeping them in their lanes — Postgres for truth, route for shape, CDN for speed."

The pattern is canonical because it's been proven across four collections (Tarot, VM, Candies, GIF) without rework. The fifth (Mibera main) is being onboarded into it as we speak.

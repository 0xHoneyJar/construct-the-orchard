#!/usr/bin/env tsx
/**
 * migrate-from-defunct-pinner.ts
 *
 * The-orchard's first cultivation event. When the pinner under a live collection
 * goes dark — e.g. the mibera Irys metadata service offline 2026-04-27 — this
 * script lifts the collection's metadata + images onto Honey Jar's own infra
 * (thj-assets S3 + CloudFront, Freeside-shaped) AND IPFS (decentralized fallback)
 * per the dual-pin policy.
 *
 * Stopgap form. The construct's eventual `migrating-storage` skill will replace
 * this with a composed pipeline. Until then, operator runs:
 *
 *   npx tsx scripts/migrate-from-defunct-pinner.ts \
 *     --manifest scripts/manifests/mibera-fractured.yaml \
 *     --output ./out/mibera-migration.result.yaml \
 *     [--dry-run] [--concurrency 4] [--ipfs-pinner pinata]
 *
 * Architecture note (recon 2026-04-27): "Freeside" in operator vocabulary maps
 * today to the existing `thj-assets` S3 bucket + CloudFront CDN. Freeside
 * proper is billing/settlement infra; metadata/asset hosting is S3. This script
 * targets the operationally-real backend. If a true Freeside metadata API
 * lands later, swap the FreesideClient impl below — interface is preserved.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { stringify as yamlStringify, parse as yamlParse } from 'yaml'

// ─────────────────────────────────────────────────────────────────────────────
// Types — the construct's eventual skill interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface MigrationManifest {
  collection: string
  contract_address: string
  chain: 'ethereum' | 'berachain' | 'base' | 'optimism' | string
  token_range: { start: number; end: number }
  dead_pinner_pattern: string  // e.g. "https://gateway.irys.xyz/mutable/{txId}/{tokenId}"
  fallback_sources: Array<'irys-direct' | 'alchemy' | 'backup'>
  alchemy_chain?: string  // alchemy SDK network name, e.g. "eth-mainnet"
  irys_tx_id?: string     // for irys-direct probes
  backup_dir?: string     // operator-provided local backup path
}

interface RecoveredMetadata {
  tokenId: number
  metadata: Record<string, unknown>
  metadata_hash: string
  image_url: string | null      // resolved image URL (may be ipfs:// or http(s)://)
  image_bytes: Buffer | null    // populated after resolution
  image_hash: string | null
  fallback_source: 'irys-direct' | 'alchemy' | 'backup' | 'unrecoverable'
  notes: string[]
}

interface PinResult {
  tokenId: number
  freeside_url: string | null   // thj-assets / CloudFront URL after upload
  ipfs_cid: string | null       // IPFS pin CID if pinner configured
  metadata_hash: string
  image_hash: string | null
  pinned_at: string             // ISO date
}

interface MigrationResultRow {
  tokenId: number
  old_uri: string
  new_freeside: string | null
  new_ipfs: string | null
  fallback_source: 'irys-direct' | 'alchemy' | 'backup' | 'unrecoverable'
  image_recovered: boolean
  notes: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    manifest: { type: 'string' },
    output: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    'ipfs-pinner': { type: 'string', default: '' },
    help: { type: 'boolean', default: false },
  },
})

if (args.help || !args.manifest) {
  console.log(`migrate-from-defunct-pinner.ts

Required:
  --manifest <path>        Migration manifest YAML (see scripts/manifests/ for examples)
  --output <path>          Where to write the result manifest (default: ./out/migration.result.yaml)

Optional:
  --dry-run                Resolve metadata + verify recovery, but skip uploads
  --concurrency <n>        Parallel token workers (default: 4; respect API rate limits)
  --ipfs-pinner <name>     One of: pinata | web3-storage | nft-storage | self-hosted (default: none)

Required env:
  ALCHEMY_API_KEY                    For fallback metadata resolution
  AWS_ACCESS_KEY_ID_VM               For thj-assets S3 upload
  AWS_SECRET_ACCESS_KEY_VM
  AWS_REGION                         (default: us-east-1)
  THJ_ASSETS_BUCKET                  (default: thj-assets)
  THJ_CDN_BASE                       (default: https://d163aeqznbc6js.cloudfront.net)

Optional env (when --ipfs-pinner set):
  PINATA_JWT                         For pinata
  NFT_STORAGE_TOKEN                  For nft-storage
  WEB3_STORAGE_TOKEN                 For web3-storage
`)
  process.exit(args.help ? 0 : 1)
}

const OUTPUT_PATH = args.output ?? './out/migration.result.yaml'
const DRY_RUN = args['dry-run'] === true
const CONCURRENCY = parseInt(args.concurrency ?? '4', 10)
const IPFS_PINNER = args['ipfs-pinner'] ?? ''

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex')
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function resolveImageUrl(imageRef: string): Promise<Buffer | null> {
  // Handle ipfs:// scheme
  if (imageRef.startsWith('ipfs://')) {
    const cid = imageRef.replace('ipfs://', '')
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`,
    ]
    for (const g of gateways) {
      try {
        const r = await fetchWithTimeout(g)
        if (r.ok) return Buffer.from(await r.arrayBuffer())
      } catch { /* try next gateway */ }
    }
    return null
  }

  if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
    try {
      const r = await fetchWithTimeout(imageRef)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
    } catch { /* fallthrough */ }
    return null
  }

  // ar:// (Arweave) — handle if needed
  if (imageRef.startsWith('ar://')) {
    const txId = imageRef.replace('ar://', '')
    try {
      const r = await fetchWithTimeout(`https://arweave.net/${txId}`)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
    } catch { /* fallthrough */ }
    return null
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery: try sources in order
// ─────────────────────────────────────────────────────────────────────────────

async function recoverFromIrysDirect(
  tokenId: number,
  manifest: MigrationManifest,
): Promise<RecoveredMetadata | null> {
  if (!manifest.irys_tx_id) return null
  const url = manifest.dead_pinner_pattern
    .replace('{txId}', manifest.irys_tx_id)
    .replace('{tokenId}', String(tokenId))
  try {
    const r = await fetchWithTimeout(url, 8000)
    if (!r.ok) return null
    const metadata = (await r.json()) as Record<string, unknown>
    const metadataStr = JSON.stringify(metadata)
    const metadata_hash = sha256(metadataStr)
    const imageRef = (metadata.image as string) ?? null
    const image_bytes = imageRef ? await resolveImageUrl(imageRef) : null
    const image_hash = image_bytes ? sha256(image_bytes) : null
    return {
      tokenId, metadata, metadata_hash, image_url: imageRef, image_bytes, image_hash,
      fallback_source: 'irys-direct',
      notes: imageRef && !image_bytes
        ? ['metadata recovered from irys-direct but image did not resolve']
        : ['recovered from irys-direct (the dead pinner is intermittent, not fully offline)'],
    }
  } catch {
    return null
  }
}

async function recoverFromAlchemy(
  tokenId: number,
  manifest: MigrationManifest,
): Promise<RecoveredMetadata | null> {
  const apiKey = process.env.ALCHEMY_API_KEY
  if (!apiKey) return null
  const network = manifest.alchemy_chain ?? 'eth-mainnet'
  // Alchemy's getNFTMetadata endpoint — cached metadata works even when pinner is dead
  const url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${manifest.contract_address}&tokenId=${tokenId}&refreshCache=false`
  try {
    const r = await fetchWithTimeout(url, 12000)
    if (!r.ok) return null
    const data = (await r.json()) as any
    if (!data?.raw?.metadata) return null
    const metadata = data.raw.metadata as Record<string, unknown>
    const metadataStr = JSON.stringify(metadata)
    const metadata_hash = sha256(metadataStr)
    const imageRef =
      (metadata.image as string) ??
      (data.image?.cachedUrl as string) ??
      (data.image?.originalUrl as string) ??
      null
    const image_bytes = imageRef ? await resolveImageUrl(imageRef) : null
    const image_hash = image_bytes ? sha256(image_bytes) : null
    return {
      tokenId, metadata, metadata_hash, image_url: imageRef, image_bytes, image_hash,
      fallback_source: 'alchemy',
      notes: ['recovered from alchemy NFT API cache'],
    }
  } catch {
    return null
  }
}

async function recoverFromBackup(
  tokenId: number,
  manifest: MigrationManifest,
): Promise<RecoveredMetadata | null> {
  if (!manifest.backup_dir) return null
  const candidatePaths = [
    join(manifest.backup_dir, `${tokenId}.json`),
    join(manifest.backup_dir, 'metadata', `${tokenId}.json`),
    join(manifest.backup_dir, 'metadata', `${tokenId}`),
  ]
  for (const p of candidatePaths) {
    if (!existsSync(p)) continue
    try {
      const raw = await readFile(p, 'utf-8')
      const metadata = JSON.parse(raw) as Record<string, unknown>
      const metadata_hash = sha256(raw)
      const imageRef = (metadata.image as string) ?? null
      let image_bytes: Buffer | null = null

      // try matching local image too
      const imgCandidates = imageRef
        ? [
            join(manifest.backup_dir, 'images', `${tokenId}.png`),
            join(manifest.backup_dir, 'images', `${tokenId}.jpg`),
            join(manifest.backup_dir, 'images', `${tokenId}.webp`),
          ]
        : []
      for (const ip of imgCandidates) {
        if (existsSync(ip)) {
          image_bytes = await readFile(ip)
          break
        }
      }
      if (!image_bytes && imageRef) image_bytes = await resolveImageUrl(imageRef)
      const image_hash = image_bytes ? sha256(image_bytes) : null
      return {
        tokenId, metadata, metadata_hash, image_url: imageRef, image_bytes, image_hash,
        fallback_source: 'backup',
        notes: [`recovered from operator backup at ${manifest.backup_dir}`],
      }
    } catch { /* try next path */ }
  }
  return null
}

async function recoverToken(
  tokenId: number,
  manifest: MigrationManifest,
): Promise<RecoveredMetadata> {
  for (const source of manifest.fallback_sources) {
    let result: RecoveredMetadata | null = null
    if (source === 'irys-direct') result = await recoverFromIrysDirect(tokenId, manifest)
    else if (source === 'alchemy') result = await recoverFromAlchemy(tokenId, manifest)
    else if (source === 'backup') result = await recoverFromBackup(tokenId, manifest)
    if (result) return result
  }
  return {
    tokenId,
    metadata: {},
    metadata_hash: '',
    image_url: null,
    image_bytes: null,
    image_hash: null,
    fallback_source: 'unrecoverable',
    notes: ['no fallback source returned metadata; route to the-mint for replant decision'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pinning: thj-assets S3 (Freeside-shape) + IPFS fallback
// ─────────────────────────────────────────────────────────────────────────────

interface FreesideClient {
  uploadImage(collection: string, tokenId: number, bytes: Buffer): Promise<{ url: string; hash: string }>
  uploadMetadata(collection: string, tokenId: number, json: Record<string, unknown>): Promise<{ url: string; hash: string }>
}

interface IpfsClient {
  pinImage(bytes: Buffer): Promise<string>      // returns CID
  pinMetadata(json: Record<string, unknown>): Promise<string>
}

class ThjAssetsClient implements FreesideClient {
  private bucket: string
  private region: string
  private cdnBase: string
  private accessKey: string
  private secretKey: string

  constructor() {
    this.bucket = process.env.THJ_ASSETS_BUCKET ?? 'thj-assets'
    this.region = process.env.AWS_REGION ?? 'us-east-1'
    this.cdnBase = process.env.THJ_CDN_BASE ?? 'https://d163aeqznbc6js.cloudfront.net'
    this.accessKey = process.env.AWS_ACCESS_KEY_ID_VM ?? ''
    this.secretKey = process.env.AWS_SECRET_ACCESS_KEY_VM ?? ''
    if (!this.accessKey || !this.secretKey) {
      throw new Error(
        'thj-assets S3 credentials missing — set AWS_ACCESS_KEY_ID_VM + AWS_SECRET_ACCESS_KEY_VM env vars',
      )
    }
  }

  private async putObject(key: string, body: Buffer | string, contentType: string): Promise<void> {
    // Lazy-load aws-sdk to avoid hard dependency in dry-run mode
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: this.region,
      credentials: { accessKeyId: this.accessKey, secretAccessKey: this.secretKey },
    })
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  }

  async uploadImage(collection: string, tokenId: number, bytes: Buffer): Promise<{ url: string; hash: string }> {
    const hash = sha256(bytes)
    // Sniff extension from magic bytes
    const ext = bytes.length > 12 && bytes.subarray(0, 4).toString('hex') === '89504e47' ? 'png'
      : bytes.length > 12 && bytes.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'jpg'
      : bytes.length > 12 && bytes.subarray(0, 4).toString() === 'RIFF' ? 'webp'
      : 'bin'
    const key = `${collection}/migrated/${tokenId}.${ext}`
    await this.putObject(key, bytes, ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'application/octet-stream')
    return { url: `${this.cdnBase}/${key}`, hash }
  }

  async uploadMetadata(collection: string, tokenId: number, json: Record<string, unknown>): Promise<{ url: string; hash: string }> {
    const body = JSON.stringify(json, null, 2)
    const hash = sha256(body)
    const key = `${collection}/migrated/${tokenId}.json`
    await this.putObject(key, body, 'application/json')
    return { url: `${this.cdnBase}/${key}`, hash }
  }
}

class PinataClient implements IpfsClient {
  private jwt: string
  constructor() {
    this.jwt = process.env.PINATA_JWT ?? ''
    if (!this.jwt) throw new Error('PINATA_JWT env unset')
  }
  async pinImage(bytes: Buffer): Promise<string> {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(bytes)]))
    const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: form,
    })
    if (!r.ok) throw new Error(`pinata pinImage failed: ${r.status} ${await r.text()}`)
    const data = (await r.json()) as { IpfsHash: string }
    return data.IpfsHash
  }
  async pinMetadata(json: Record<string, unknown>): Promise<string> {
    const r = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinataContent: json }),
    })
    if (!r.ok) throw new Error(`pinata pinMetadata failed: ${r.status} ${await r.text()}`)
    const data = (await r.json()) as { IpfsHash: string }
    return data.IpfsHash
  }
}

function makeIpfsClient(name: string): IpfsClient | null {
  if (!name) return null
  if (name === 'pinata') return new PinataClient()
  // nft-storage / web3-storage / lighthouse impls TBD — Pinata covers the immediate need
  console.warn(`[ipfs] pinner '${name}' not implemented in this stopgap — IPFS leg will be skipped. Implement in construct's pinning-to-ipfs skill.`)
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main migration loop
// ─────────────────────────────────────────────────────────────────────────────

async function migrateToken(
  recovered: RecoveredMetadata,
  manifest: MigrationManifest,
  freeside: FreesideClient,
  ipfs: IpfsClient | null,
): Promise<PinResult> {
  if (recovered.fallback_source === 'unrecoverable' || !recovered.image_bytes) {
    return {
      tokenId: recovered.tokenId,
      freeside_url: null,
      ipfs_cid: null,
      metadata_hash: recovered.metadata_hash,
      image_hash: null,
      pinned_at: new Date().toISOString(),
    }
  }

  // Upload image first (so metadata can reference it)
  const freesideImage = await freeside.uploadImage(manifest.collection, recovered.tokenId, recovered.image_bytes)
  let ipfsImageCid: string | null = null
  if (ipfs) {
    try {
      ipfsImageCid = await ipfs.pinImage(recovered.image_bytes)
    } catch (e) {
      console.warn(`[token ${recovered.tokenId}] ipfs image pin failed: ${(e as Error).message}`)
    }
  }

  // Compose the new metadata — point image at freeside primary; record IPFS cid if available
  const newMetadata = {
    ...recovered.metadata,
    image: ipfsImageCid ? `ipfs://${ipfsImageCid}` : freesideImage.url,
    image_url: freesideImage.url,
    // preserve original metadata's other fields
  }

  const freesideMeta = await freeside.uploadMetadata(manifest.collection, recovered.tokenId, newMetadata)
  let ipfsMetaCid: string | null = null
  if (ipfs) {
    try {
      ipfsMetaCid = await ipfs.pinMetadata(newMetadata)
    } catch (e) {
      console.warn(`[token ${recovered.tokenId}] ipfs metadata pin failed: ${(e as Error).message}`)
    }
  }

  return {
    tokenId: recovered.tokenId,
    freeside_url: freesideMeta.url,
    ipfs_cid: ipfsMetaCid,
    metadata_hash: freesideMeta.hash,
    image_hash: freesideImage.hash,
    pinned_at: new Date().toISOString(),
  }
}

async function main() {
  const manifestPath = args.manifest as string
  const manifest = yamlParse(await readFile(manifestPath, 'utf-8')) as MigrationManifest

  console.log(`# migrate-from-defunct-pinner`)
  console.log(`# collection: ${manifest.collection}`)
  console.log(`# contract: ${manifest.contract_address}`)
  console.log(`# tokens: ${manifest.token_range.start}..${manifest.token_range.end}`)
  console.log(`# fallback sources: ${manifest.fallback_sources.join(', ')}`)
  console.log(`# dry-run: ${DRY_RUN}`)
  console.log(`# concurrency: ${CONCURRENCY}`)
  console.log(`# ipfs pinner: ${IPFS_PINNER || '(none — single-pin only)'}`)

  const freeside: FreesideClient = DRY_RUN
    ? {
        uploadImage: async (_c, t, b) => ({ url: `dry-run://thj-assets/${t}.bin`, hash: sha256(b) }),
        uploadMetadata: async (_c, t, j) => ({ url: `dry-run://thj-assets/${t}.json`, hash: sha256(JSON.stringify(j)) }),
      }
    : new ThjAssetsClient()

  const ipfs = DRY_RUN
    ? null
    : makeIpfsClient(IPFS_PINNER)

  if (!DRY_RUN && !ipfs && IPFS_PINNER) {
    console.warn(`[main] ipfs pinner '${IPFS_PINNER}' resolved to null — single-pin migration only`)
  }
  if (!DRY_RUN && !ipfs && !IPFS_PINNER) {
    console.warn(`[main] no --ipfs-pinner specified — running single-pin (Freeside only). The dual-pin policy is degraded for this run.`)
  }

  const tokens: number[] = []
  for (let i = manifest.token_range.start; i <= manifest.token_range.end; i++) tokens.push(i)

  const results: MigrationResultRow[] = []
  let processed = 0

  // Concurrency-limited worker pool
  async function worker(queue: number[]) {
    while (queue.length > 0) {
      const tokenId = queue.shift()
      if (tokenId === undefined) break
      try {
        const recovered = await recoverToken(tokenId, manifest)
        if (recovered.fallback_source === 'unrecoverable') {
          results.push({
            tokenId,
            old_uri: manifest.dead_pinner_pattern.replace('{txId}', manifest.irys_tx_id ?? '').replace('{tokenId}', String(tokenId)),
            new_freeside: null,
            new_ipfs: null,
            fallback_source: 'unrecoverable',
            image_recovered: false,
            notes: recovered.notes,
          })
        } else {
          const pinned = await migrateToken(recovered, manifest, freeside, ipfs)
          results.push({
            tokenId,
            old_uri: manifest.dead_pinner_pattern.replace('{txId}', manifest.irys_tx_id ?? '').replace('{tokenId}', String(tokenId)),
            new_freeside: pinned.freeside_url,
            new_ipfs: pinned.ipfs_cid ? `ipfs://${pinned.ipfs_cid}` : null,
            fallback_source: recovered.fallback_source,
            image_recovered: !!recovered.image_bytes,
            notes: recovered.notes,
          })
        }
      } catch (err) {
        results.push({
          tokenId,
          old_uri: manifest.dead_pinner_pattern.replace('{txId}', manifest.irys_tx_id ?? '').replace('{tokenId}', String(tokenId)),
          new_freeside: null,
          new_ipfs: null,
          fallback_source: 'unrecoverable',
          image_recovered: false,
          notes: [`worker error: ${(err as Error).message}`],
        })
      }
      processed++
      if (processed % 50 === 0 || processed === tokens.length) {
        console.log(`[progress] ${processed} / ${tokens.length}`)
      }
    }
  }

  const queue = [...tokens]
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))
  results.sort((a, b) => a.tokenId - b.tokenId)

  const summary = {
    collection: manifest.collection,
    contract: manifest.contract_address,
    chain: manifest.chain,
    dead_pinner: manifest.dead_pinner_pattern,
    migrated_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    tokens_walked: results.length,
    fallback_sources_used: {
      'irys-direct': results.filter(r => r.fallback_source === 'irys-direct').length,
      alchemy: results.filter(r => r.fallback_source === 'alchemy').length,
      backup: results.filter(r => r.fallback_source === 'backup').length,
      unrecoverable: results.filter(r => r.fallback_source === 'unrecoverable').length,
    },
    images_recovered: results.filter(r => r.image_recovered).length,
    dual_pinned: results.filter(r => r.new_freeside && r.new_ipfs).length,
    single_pinned: results.filter(r => r.new_freeside && !r.new_ipfs).length,
    failed: results.filter(r => !r.new_freeside).length,
    ready_for_setTokenURI: results.filter(r => r.new_freeside).length === results.length,
    results,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, yamlStringify(summary), 'utf-8')

  console.log(`\n# summary`)
  console.log(`#   recovered:   ${results.length - (summary.fallback_sources_used.unrecoverable)} / ${results.length}`)
  console.log(`#   dual-pinned: ${summary.dual_pinned}`)
  console.log(`#   single-pin:  ${summary.single_pinned} (degraded — IPFS leg missing)`)
  console.log(`#   failed:      ${summary.failed}`)
  console.log(`#   output:      ${OUTPUT_PATH}`)
  console.log(`\n# next: hand ${OUTPUT_PATH} to protocol for setTokenURI batch.`)
  if (summary.failed > 0) {
    console.log(`# WARNING: ${summary.failed} tokens unrecoverable — route to the-mint for replant decisions.`)
  }
}

main().catch((err) => {
  console.error(`[fatal] ${err.stack ?? err.message}`)
  process.exit(2)
})

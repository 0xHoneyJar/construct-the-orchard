---
name: verifying-pin
description: Probe a pinned URI (Freeside or IPFS) and confirm it resolves to content matching the recorded hash. Returns a Verdict the dual-pin policy enforcement reads.
user-invocable: true
allowed-tools: Read, Bash
---

# Verifying Pin

Trust but verify. After every `pinning-to-freeside` or `pinning-to-ipfs` call, this skill probes the URI and confirms the bytes still resolve. Detects silent pin loss (Freeside outages, IPFS gateway failures, expired Pinata pins).

## When to use

- Immediately after a pin lands (in-line verification)
- Periodic recurring health probe (called by `tending-storage`)
- Pre-flight check before `scheduling-drops` or `grafting-traits` (won't graft onto missing soil)

## When NOT to use

- The URI was just generated and not yet propagated to gateways (sleep + retry, don't false-flag)
- The operator wants the actual content (use `curl` or the SDK directly)

## Workflow

1. Read the URI + expected hash from the manifest entry.
2. For Freeside URIs: HTTP HEAD + GET, sha256 the body, compare hash.
3. For IPFS URIs: probe at least 2 gateways (`ipfs.io`, `cloudflare-ipfs.com`, `dweb.link`, etc.), require ≥1 to resolve and match hash.
4. Emit a Verdict per probe (info/medium/high based on outcome).
5. Update `last_verified` in the pin manifest.

## Output shape

```typescript
interface VerifyResult {
  uri: string
  expected_hash: string
  actual_hash: string | null
  resolved: boolean
  gateways_tried: string[]
  gateways_succeeded: string[]
  severity: 'info' | 'medium' | 'high'
  notes: string
}
```

## Anti-patterns

- **Single-gateway IPFS verification.** Tests confidence, not resolution. Multi-gateway probe is the policy.
- **Trusting HTTP 200 alone.** A pinner can return 200 with stale or rewritten content. Hash comparison is the contract.
- **Auto-repair.** Verifying-pin reports; `tending-storage` decides how to repair. Verification is read-only.

## Composes with

- **Called by**: `tending-storage` (recurring) · `pinning-to-freeside`/`pinning-to-ipfs` (post-pin in-line check) · `grafting-traits` (pre-graft substrate check)
- **Reports to**: `tending-storage` consumes the Verdict for classification

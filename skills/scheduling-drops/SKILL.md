---
name: scheduling-drops
description: Plan a time-locked operational event — mint, graft drop, harvest event — with substrate pre-flight, broadcast composition, and on-landing verification. Operational moment within a cultivating-cycle.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Scheduling Drops

A *drop* is an operational moment in a cultivation cycle: a time-locked event where something happens to the collection (new mint, graft event, lore reveal, gated harvest). This skill plans the drop, runs pre-flight, composes the announcement, and verifies on-landing.

## When to use

- Cycle plan calls for a time-locked event
- One-shot drop outside a cycle (operator-driven; rare)
- Recovery drop after an incident (e.g. "the migration is complete; mint a commemorative trait")

## When NOT to use

- The "drop" is actually a quiet release with no time-lock — just call the underlying skill (`grafting-traits`, `the-mint`)
- The drop requires generating new assets — `the-mint` first, then schedule
- The drop requires a contract change beyond `setTokenURI` — escalate to `protocol`

## Workflow

1. **Validate drop spec.** Required: drop-id, scheduled time, type (mint / graft-event / harvest-event), scope (which tokens / holders), success signals.

2. **Pre-flight.**
   - Substrate check: `tending-storage --shallow` on affected tokens (must be healthy)
   - Asset readiness: if the drop produces new images, `the-mint` confirms the assets are ready
   - Broadcast prep: `herald` composes the announcement copy + `social-oracle` confirms posting credentials

3. **Schedule.** Write the drop spec to `cultivations/{collection}/drops/{drop-id}.yaml`. Optionally register a cron / scheduled job for the drop time.

4. **At drop time.** Dispatch the underlying operations (call `grafting-traits` for a graft drop, `the-mint` + `protocol` for a mint drop, etc.). Watch for failures.

5. **On-landing verification.** Call `verifying-mutation` (graft drops) or `verifying-pin` (mint drops). Verify the drop actually produced the intended state.

6. **Broadcast.** Hand to `herald` for announcement composition; `social-oracle` posts.

7. **Log.** Append to `cultivations/{collection}/cycle-{n}.log.yaml` — drop happened, what landed, what didn't.

## Output shape

```yaml
# grimoires/{product}/cultivations/{collection}/drops/{drop-id}.yaml
drop_id: spring-graft-drop-2026
collection: <name>
cycle_id: cultivation-2026-Q2
scheduled_for: 2026-05-15T18:00Z
type: graft-event
scope:
  tokens: [10, 24, 42, 89]
  holders: derived  # from on-chain ownerOf at drop time
status: scheduled  # scheduled | preflight-ready | landed | partial | failed
success_signals:
  - "all 4 grafts committed on-chain"
  - "announcement posted to discord + twitter"
preflight:
  substrate: healthy
  assets: ready
  broadcast: ready
landed:
  grafts_committed: 4
  grafts_pending: 0
  grafts_failed: 0
  announcement_posted: true
post_drop_audit_due: 2026-05-16
```

## Anti-patterns

- **Scheduling without substrate check.** A drop on unhealthy substrate breaks publicly. Pre-flight is mandatory.
- **Skipping broadcast prep.** The drop lands in code; no one knows it happened. Operator-only drops without announcement are sometimes fine, but make it explicit.
- **Cron without retry semantics.** Network hiccups happen. Define retry policy at scheduling time, not improvisation at drop time.
- **Calling drops "launches".** A launch is the collection's first appearance. A drop is an operational moment within the collection's life. Burbank's voice cares about the distinction.

## Composes with

- **Reads**: cycle plan from `cultivating-cycle`
- **Pre-flight**: `tending-storage` · `the-mint` · `herald`
- **Dispatches**: `grafting-traits` · `the-mint` + `protocol` (mint drops) · `harvesting-input` (harvest events)
- **Post-landing**: `verifying-mutation` · `verifying-pin`
- **Broadcasts via**: `herald` + `social-oracle`

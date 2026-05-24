# Worker Maintainer Instructions

## Change Strategy
- Preserve API stability for pool and IPC contracts.
- Keep lifecycle transitions explicit and testable.
- Prefer additive capability over breaking scheduling semantics.

## Implementation Notes
- Keep queue/scheduling logic deterministic where possible.
- Ensure worker crash/failure events are surfaced consistently.
- Avoid hidden coupling to runtime environment assumptions.

## Validation
- Run worker module tests for pool and IPC paths.
- Validate failure-mode behavior with representative crash/timeouts.
- Recheck graceful shutdown with active queued work.

## Regression Checklist
- Pool behavior remains predictable.
- IPC contracts remain compatible.
- Lifecycle handling remains robust.

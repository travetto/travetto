# Registry Maintainer Overview
Maintainer guidance for adapter/index lifecycle and initialization semantics.

## Ownership
- Registry bootstrap and finalization lifecycle.
- Adapter-to-index registration flow.
- Shared index-store behavior and lookup consistency.

## High-Signal Entry Points
- src/registry.ts
- src/types.ts
- src/store.ts

## Integration Boundaries
- Foundation for modules that depend on decorator-discovered metadata.
- Must remain deterministic during startup and hot-reload/re-init flows.

## Compatibility Boundaries
- Registration timing and index finalization semantics are externally consumed.
- Adapter/index contract behavior is semver-sensitive for downstream modules.

## Testing Expectations
- Validate registration/finalization ordering behavior.
- Validate deterministic index contents for repeated startup flows.
- Recheck compatibility for representative downstream registry consumers.

## Change-Triage Guidance
- Lifecycle changes: test startup/restart/re-init ordering and idempotency.
- Store/index changes: verify lookup stability and iteration ordering assumptions.
- Type contract changes: validate adapters and indexes across dependent modules.

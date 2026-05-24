# Model Redis Maintainer Overview
Maintainer guidance for Redis model persistence and indexed maintenance behavior.

## Ownership
- Redis CRUD/storage/expiry provider implementation.
- Redis key resolution and namespace behavior.
- Indexed key/sorted-set mutation and scan logic.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- README.md
- support/

## Integration Boundaries
- Depends on @travetto/model and @travetto/model-indexed contracts.
- Uses Redis primitives for key-value, set, and sorted-set behaviors.
- Integrates with runtime/di lifecycle for startup and shutdown.

## Invariants
- Index mutation on write/delete must remain synchronized with base record state.
- Key resolution and namespace composition must remain deterministic.
- Expiry-aware reads must not expose expired records as live results.
- Unsupported index warnings must remain accurate and visible.

## Extension Points
- `RedisModelConfig` can be extended additively for client options.
- Service can be wrapped/replaced through DI while preserving contracts.
- Scan/index internals can evolve if contract-visible behavior is stable.

## Testing Expectations
- Run module tests for CRUD, indexed, and expiry paths.
- Validate scan behavior with paging, offsets, and abort signals.
- Recheck index cleanup/update behavior whenever write-path code changes.

## Risk Areas
- Index drift from record state can produce hard-to-debug retrieval bugs.
- Namespace/key-shape changes can break existing persisted data discoverability.
- Sorted-index behavior for mixed value types is regression-prone.
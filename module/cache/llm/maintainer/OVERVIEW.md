# Cache Maintainer Overview
Maintainer guidance for @travetto/cache decorator and runtime cache behavior.

## Ownership
- Method-level cache decorator semantics.
- Eviction signaling behavior and contracts.
- Key generation mechanics and cache config model.

## High-Signal Entry Points
- src/decorator.ts
- src/service.ts
- src/util.ts
- src/types.ts

## Integration Boundaries
- Relies on expiry/storage-capable backing providers.
- Decorator behavior must remain deterministic and safe for concurrent calls.

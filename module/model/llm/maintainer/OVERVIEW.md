# Model Maintainer Overview
Maintainer guidance for @travetto/model core contracts and lifecycle hooks.

## Ownership
- Persistence contracts and capability typing.
- Model metadata registry and decorator behavior.
- Pre-persist/post-load lifecycle execution semantics.

## High-Signal Entry Points
- src/registry/decorator.ts
- src/registry/index.ts
- src/types/ (service contracts)
- src/util/crud.ts
- src/util/bulk.ts
- src/util/storage.ts
- src/util/blob.ts
- src/util/expiry.ts

## Integration Boundaries
- Upstream contract for all model-* provider modules.
- Changes can ripple across provider implementations.

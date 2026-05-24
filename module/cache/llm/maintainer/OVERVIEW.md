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

## Compatibility Boundaries
- @Cache/@EvictCache decorator semantics and key derivation behavior are semver-sensitive.
- Cache service serialization and reinstatement behavior is externally visible.

## Testing Expectations
- Validate hit/miss/ttl behavior across deterministic method variants.
- Validate eviction timing and mutation-path correctness.
- Recheck key-space isolation for multi-tenant and mixed-parameter cases.

## Change-Triage Guidance
- Key-generation changes: run compatibility checks against existing cached key patterns.
- Decorator behavior changes: verify method error handling and eviction sequencing.
- Serialization changes: validate rehydration and backward compatibility.

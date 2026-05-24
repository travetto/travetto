# Cache Maintainer Instructions

## Change Strategy
- Preserve @Cache and @EvictCache semantics as compatibility-sensitive APIs.
- Keep key generation deterministic across process restarts.

## Implementation Notes
- Treat CacheUtil.generateKey changes as potentially breaking.
- Keep serialization/reinstatement hooks stable.
- Validate behavior around method errors and eviction timing.

## Validation
- Verify hit/miss behavior and TTL expiry paths.
- Validate key-space isolation and mutation-path eviction.

## Regression Checklist
- Key generation remains deterministic across restarts.
- Eviction sequencing remains correct for successful and failed mutations.
- Serialization/reinstatement remains stable for existing cached payloads.

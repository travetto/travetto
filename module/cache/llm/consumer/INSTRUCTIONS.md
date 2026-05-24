# Cache Instructions
How to add reliable method-level caching.

## Setup
1. Annotate expensive deterministic methods with @Cache.
2. Configure maxAge and key-space behavior.
3. Add @EvictCache on write/update methods where stale reads are possible.

## Usage Workflow
- Keep cache keys stable and deterministic.
- Use explicit key-space partitioning for multi-tenant or multi-domain scenarios.
- Prefer short TTLs initially, then tune based on hit/miss behavior.

## Safe Defaults
- Cache only side-effect-free methods.
- Avoid caching responses containing request-specific secrets.
- Keep serialization strategy consistent across producers/consumers.

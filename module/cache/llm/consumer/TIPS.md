# Cache Tips
- Validate key strategy first when cache misses look unexpected.
- Use CacheUtil semantics to avoid subtle key-shape drift.
- Pair @Cache with targeted @EvictCache on mutation paths.
- Prefer measurable cache metrics before increasing TTL aggressively.

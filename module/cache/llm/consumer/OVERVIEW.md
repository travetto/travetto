# Cache Overview
The @travetto/cache module provides declarative method-level caching backed by expiry-capable storage providers.

## Primary Capabilities
- Decorator-driven cache reads/writes around method execution.
- Configurable TTL and key-space behavior.
- Pluggable key generation strategy.
- Optional cache eviction trigger support.

## Decorators
- @Cache: cache method results with configurable maxAge/key semantics.
- @EvictCache: evict cache entries after successful method execution.

## Utility Classes (Non-Internal)
- CacheUtil: cache-key generation helpers from config and method parameters.

## When to use it
Use this module when expensive deterministic method outputs should be reused safely over time.

# Cache Overview
The @travetto/cache module provides declarative method-level caching backed by expiry-capable storage providers.

## What This Module Is
This module wraps method execution with configurable cache read/write and eviction behavior.

## Why To Use It
- It reduces repeated expensive computation and IO.
- It keeps cache policy close to the method contract.
- It allows provider flexibility through expiry-capable model backends.

## When To Use It
- Use for deterministic async methods with reusable outputs.
- Use when key-space, TTL, and invalidation behavior need explicit control.
- Use when cached values are JSON-serializable or custom-serialized.

## When Not To Use It
- Do not cache methods with side effects or non-deterministic outputs unless intentional.
- Do not cache values that cannot be safely serialized/reinstated.

## Core Capabilities
- Decorator-driven cache reads/writes around method execution.
- Configurable TTL and key-space behavior.
- Pluggable key generation strategy.
- Optional cache eviction trigger support.

## Decorators
- @Cache: cache method results with configurable maxAge/key semantics.
- @EvictCache: evict cache entries after successful method execution.

## Utility Classes (Non-Internal)
- CacheUtil: cache-key generation helpers from config and method parameters.

## Core APIs and Extension Points
- @Cache and @EvictCache decorators.
- CacheService for direct cache operations.
- CacheModelSymbol binding for custom model-backed cache providers.

Decision guideline:
Use decorator-driven caching for deterministic method results with explicit key-space and eviction behavior, rather than ad hoc cache checks inside method bodies.

## Typical Integration Flow
1. Register/cache-inject a CacheService.
2. Add @Cache to expensive read methods.
3. Add @EvictCache to mutating methods that invalidate read keys.
4. Tune key/maxAge/params based on domain behavior.

## Practical Scenario
For user profile reads, cache getUser(id) and evict on update/delete so high-traffic reads stay fast while writes preserve correctness.

Common pitfalls:
- Caching non-deterministic or side-effectful methods and creating correctness bugs.
- Using unstable key generation inputs that change across process/version boundaries.
- Forgetting eviction on mutation paths and serving stale data.


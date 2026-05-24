# Model Redis Overview
The @travetto/model-redis module provides a Redis-backed implementation of Travetto model contracts.

## What This Module Is
This module exports `RedisModelService` and `RedisModelConfig` for CRUD, expiry, storage, and model-indexed operations on Redis.

## Why To Use It
- It provides fast key-based persistence with a lightweight operational footprint.
- It supports deterministic indexed access patterns through model-indexed contracts.
- It keeps application logic aligned to shared model contracts instead of Redis-specific APIs.

## When To Use It
- Use it when Redis is your chosen backing store for model data.
- Use it when indexed lookup and sorted-index scan flows are needed.
- Use it when you want contract-driven CRUD with optional namespace isolation.

## When Not To Use It
- Do not use it when full query-contract features are required.
- Do not assume unique index semantics are enforced the same way as relational backends.
- Do not use it as a drop-in replacement for systems requiring strong relational constraints.

## Core Capabilities
- `RedisModelService` supports CRUD, expiry-aware reads, storage lifecycle, and indexed operations.
- Keyed and sorted index maintenance is managed during create/update/delete flows.
- Namespace-aware key resolution for environment isolation.
- Streaming list/index scans with paging-compatible options.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes; primary API is `RedisModelService` and `RedisModelConfig`.

## Core APIs and Extension Points
- `RedisModelConfig` is bound at `model.redis` and controls client options and namespace.
- `RedisModelService` is the runtime provider surface for CRUD and indexed contracts.
- Service wiring can be customized via DI factory registration.

Decision guideline:
Use model-redis when low-latency key access and deterministic indexed patterns are primary requirements, and full query-contract semantics are not required.

## Typical Integration Flow
1. Configure `model.redis` client options and optional namespace.
2. Resolve `RedisModelService` through DI as the active provider.
3. Use CRUD and indexed contracts from application code.
4. Use storage lifecycle methods for initialization and teardown flows.

## Practical Scenario
An event-processing service stores short-lived entities in Redis and retrieves them through computed indexes by tenant and timestamp. Application code remains provider-agnostic by using model/indexed contracts while Redis handles fast key and sorted-set operations under the hood.

Common pitfalls:
- Assuming index mutation consistency without validating write/delete and index-update paths together.
- Relying on unbounded scans for API endpoints with unpredictable cardinality.
- Treating Redis index uniqueness behavior as equivalent to relational constraints.
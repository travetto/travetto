# Model Memory Overview
The @travetto/model-memory module provides an in-memory implementation of Travetto model storage contracts.

## What This Module Is
This module exports a concrete `MemoryModelService` and related configuration for CRUD, blob, expiry, storage, and computed-index support backed entirely by process memory.

## Why To Use It
- It is simple to wire up for local development and tests.
- It implements a broad set of model capabilities in one provider.
- It serves as a useful reference backend when learning Travetto model behavior.

## When To Use It
- Use it for test suites, prototypes, local tooling, and ephemeral application data.
- Use it when you want predictable provider behavior without external infrastructure.
- Use it when verifying model lifecycle, expiry, blob, or indexed behavior in development.

## When Not To Use It
- Do not use it for production persistence that must survive process restarts.
- Do not assume it models concurrency, replication, or datastore-specific guarantees.
- Do not use it when you need backend-native query features from a real database engine.

## Core Capabilities
- In-memory CRUD operations through `MemoryModelService`.
- Blob and blob-metadata storage in dedicated namespaces.
- Expiry-aware reads and culling support.
- Storage initialization support plus computed-index integration.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes; the primary public surface is `MemoryModelService` and `MemoryModelConfig`.

## Core APIs and Extension Points
- `MemoryModelService` implements `ModelCrudSupport`, `ModelBlobSupport`, `ModelExpirySupport`, `ModelStorageSupport`, and `ModelIndexedSupport`.
- `MemoryModelConfig` provides `modifyStorage`, `namespace`, and `cullRate` configuration under `model.memory`.
- The `client` getter exposes the underlying map store for inspection-oriented workflows.

## Typical Integration Flow
1. Add @travetto/model-memory to a project that already defines models with @travetto/model.
2. Configure `model.memory` if you need namespacing or custom expiry culling cadence.
3. Inject or resolve `MemoryModelService` as the active model provider in tests or local development.
4. Exercise CRUD, blob, expiry, and indexed paths against the same provider.

## Practical Scenario
For integration tests around file uploads and account expiry, use `MemoryModelService` to store user records, blob payloads, and expiry timestamps without provisioning an external database. The same suite can validate index-based lookups and blob retrieval while still staying fast and isolated per test run.
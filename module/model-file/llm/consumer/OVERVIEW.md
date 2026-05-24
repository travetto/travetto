# Model File Overview
The @travetto/model-file module provides file-system-backed implementations of core model contracts.

## What This Module Is
This module exports `FileModelService` and `FileModelConfig` for CRUD, blob, expiry, and storage operations persisted as files on disk.

## Why To Use It
- It offers a lightweight provider without external datastore dependencies.
- It supports blob and expiry behavior in the same provider.
- It is useful for local tooling, tests, and low-complexity persistence scenarios.

## When To Use It
- Use it for development/test environments where file persistence is sufficient.
- Use it when simple CRUD + blob + expiry behavior is needed with minimal setup.
- Use it when provider portability through model contracts still matters.

## When Not To Use It
- Do not use it for high-concurrency or distributed production workloads.
- Do not use it when query/indexed contracts are required.
- Do not assume file-system behavior matches database consistency/performance characteristics.

## Core Capabilities
- `FileModelService` supports CRUD, blob operations, expiry cleanup, and storage lifecycle.
- `FileModelConfig` controls root folder, namespace, and culling cadence.
- Batched file scanning for list and expiry cleanup operations.
- Blob content and metadata handling through file pairs.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes; the primary API is `FileModelService` and `FileModelConfig`.

## Core APIs and Extension Points
- `FileModelConfig` is bound at `model.file` and controls filesystem behavior.
- `FileModelService` provides CRUD/blob/expiry/storage contract methods.
- Service wiring can be customized via DI factories when needed.

## Typical Integration Flow
1. Configure `model.file` folder/namespace settings.
2. Resolve `FileModelService` via DI as the active provider.
3. Use shared model CRUD and blob contracts in application code.
4. Run expiry and truncate operations through provider contract methods.

## Practical Scenario
A CLI tool needs persistent state and binary artifact storage without external infrastructure. It uses `FileModelService` for model documents and blobs under a namespaced folder, keeping the same contract-oriented code that can later move to another provider if requirements grow.
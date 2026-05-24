# Model Overview
The @travetto/model module defines the core datastore abstraction for application entities and persistence workflows.

## What This Module Is
This module is the persistence contract layer for Travetto entities, defining model metadata and storage capability interfaces.

## Why To Use It
- It decouples business logic from datastore-specific implementations.
- It standardizes CRUD/expiry/blob/bulk patterns across providers.
- It provides lifecycle hooks around persistence and retrieval.

## When To Use It
- Use for application entities that must be persisted.
- Use when storage backend portability matters.
- Use when hooks/transient fields/expiry semantics are needed on models.

## When Not To Use It
- Do not bind service logic directly to one provider API unless portability is irrelevant.
- Do not store ephemeral computed values as persisted fields when @Transient is more appropriate.

## Core Capabilities
- Typed model declaration built on schema.
- CRUD, bulk, blob, storage, and expiry capability contracts.
- Pre-persist and post-load lifecycle hooks.
- Backend-agnostic service interfaces.

## Decorators
- @Model: mark a class as a persisted model.
- @ExpiresAt: mark the field used for expiry semantics.
- @PrePersist: register a pre-persist lifecycle handler.
- @PersistValue: declaratively set a value before persistence.
- @Transient: mark a field as non-persisted.
- @PostLoad: register post-load lifecycle behavior.

## Utility Classes (Non-Internal)
- ModelCrudUtil: core CRUD support guards and lifecycle helpers.
- ModelBulkUtil: bulk operation preparation/support checks.
- ModelStorageUtil: storage initialization and capability helpers.
- ModelBlobUtil: blob support checks and URL support guards.
- ModelExpiryUtil: expiry-state inspection and culling registration.

## Core APIs and Extension Points
- Model capability interfaces (basic/crud/bulk/blob/expiry).
- Utility guards for checking provider support.

## Typical Integration Flow
1. Define an entity with @Model and required field decorators.
2. Persist/retrieve through model service contracts.
3. Add lifecycle decorators for normalization or hydration behavior.
4. Use utility guards for optional features (blob/expiry/bulk).

## Practical Scenario
When migrating from in-memory to persistent storage, keep domain code unchanged by targeting model contracts and swapping provider implementations.


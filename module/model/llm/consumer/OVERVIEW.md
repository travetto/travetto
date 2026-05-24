# Model Overview
The @travetto/model module defines the core datastore abstraction for application entities and persistence workflows.

## Primary Capabilities
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

## When to use it
Use this module for all persistent domain entities and for writing provider-agnostic data workflows.

# Model Mongo Maintainer Instructions

## Change Strategy
- Keep provider behavior aligned with shared model/query/indexed contracts.
- Treat config parsing and startup initialization as production-critical code paths.
- Preserve additive compatibility for configuration fields and service methods.

## Implementation Notes
- Validate `_id` and `id` conversion behavior whenever write/read paths change.
- Keep index lifecycle updates and query/indexed behavior in sync.
- Maintain clear separation between model documents and blob bucket operations.

## Validation
- Run module tests and at least one integration scenario covering CRUD, query, indexed, and blob operations.
- Recheck startup behavior with and without connection strings, including TLS settings.

Regression checklist:
- `_id` and `id` mapping remains stable across create/get/update paths.
- Index lifecycle behavior (create/update/drop) remains consistent with model metadata.
- Config finalization preserves explicit overrides while applying defaults.
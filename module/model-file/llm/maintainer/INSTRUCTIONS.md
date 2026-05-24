# Model File Maintainer Instructions

## Change Strategy
- Keep filesystem behavior predictable and deterministic.
- Preserve stable file naming and namespace structure.
- Prefer additive config behavior over changing existing path semantics.

## Implementation Notes
- Treat serialization/deserialization changes as compatibility-sensitive.
- Keep blob metadata and binary writes atomically coordinated where possible.
- Re-test expiry scanning and list batching after any scan logic edits.

## Validation
- Run module tests and representative file-based integration scenarios.
- Recheck CRUD, blob, expiry, and truncate/delete storage behavior after changes.

Regression checklist:
- Namespace and path derivation remains deterministic across environments.
- Blob metadata and payload files remain synchronized under failures.
- Expiry/list batching behavior remains correct for large directory sets.
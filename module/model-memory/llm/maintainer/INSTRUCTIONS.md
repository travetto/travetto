# Model Memory Maintainer Instructions

## Change Strategy
- Keep this provider a clear, dependable reference implementation.
- Favor readability and behavioral correctness over backend-style optimization.
- Preserve broad capability coverage across CRUD, blob, expiry, storage, and indexed paths.

## Implementation Notes
- Any write-path change must be checked against index cleanup and index rebuild behavior.
- Keep blob namespaces separate from model namespaces.
- Changes to `initializeClient` can affect startup behavior across tests and sample apps.

## Validation
- Run the module test suite and targeted global or support tests that use model-memory.
- Recheck unique-index conflicts, expired reads, and blob metadata flows after edits.

Regression checklist:
- Create/update/delete keep index structures synchronized.
- Expired items are not returned from `get` and list-like flows.
- Blob metadata and payload files remain coherent after update/delete operations.
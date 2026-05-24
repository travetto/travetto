# Model Memory Maintainer Overview
Maintainer guidance for the in-memory reference implementation of Travetto model contracts.

## Ownership
- Concrete in-memory implementations for CRUD, blob, expiry, storage, and indexed model support.
- Reference behavior for many cross-provider tests and examples.
- Memory-backed namespace and index bookkeeping.

## High-Signal Entry Points
- src/service.ts
- README.md
- test/

## Integration Boundaries
- Depends on @travetto/model for lifecycle and capability utilities.
- Depends on @travetto/model-indexed for computed index contracts and helpers.
- Often acts as the easiest concrete backend for global-test and support-suite coverage.

Compatibility boundaries:
- Error behavior (`NotFoundError`, `ExistsError`, indexed failures) is used as reference semantics by downstream suites.
- Capability coverage breadth is intentional; removing or weakening support surface can break provider parity expectations.

## Invariants
- Persist paths must keep stored records and index state synchronized.
- Blob content and blob metadata must remain isolated from normal model records.
- Expired records must not be returned as live reads.
- Unique indexed keys must fail consistently when conflicting records are written.

## Extension Points
- `MemoryModelConfig` is the supported way to tune namespace, storage mutation policy, and culling cadence.
- Additional provider behavior should be added through the existing capability contracts rather than ad hoc methods.

## Testing Expectations
- Run direct module tests plus at least one downstream suite that uses model-memory as the active provider.
- Revalidate CRUD lifecycle, blob range behavior, expiry culling, and indexed operations after changes.

Change-triage guidance:
- Write-path changes: verify index add/remove symmetry plus expiry persistence behavior.
- Blob-path changes: verify metadata and payload mutation/read flows, including ranged reads.
- Initialization/config changes: validate namespace isolation and cull registration behavior across test suites.

## Risk Areas
- Index maintenance is tightly coupled to create, update, and delete flows.
- Namespace handling and storage initialization can affect test isolation.
- Small changes in expiry or blob handling can break seemingly unrelated integration suites.
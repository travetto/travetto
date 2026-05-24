# Model File Maintainer Overview
Maintainer guidance for filesystem-backed model service behavior.

## Ownership
- File-backed CRUD/blob/expiry/storage implementation.
- Path resolution, namespace layout, and file naming conventions.
- Batch scanning and cleanup behavior.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- README.md

## Integration Boundaries
- Depends on @travetto/model contracts and utilities.
- Integrates with runtime/config/di modules for lifecycle and path/config handling.
- Exposes no query/indexed capabilities by design.

Compatibility boundaries:
- File naming, namespace layout, and serialization semantics are data-compatibility boundaries and must remain stable.
- Blob metadata/content synchronization behavior is externally observable and semver-sensitive.

## Invariants
- Document file writes/reads must preserve model serialization and id semantics.
- Blob content and metadata files must stay synchronized.
- Expiry handling must not return expired items as live reads.
- Namespace/path derivation must remain deterministic.

## Extension Points
- `FileModelConfig` can be extended additively for new filesystem options.
- Service replacement/wrapping can be done through DI.
- Internal batching behavior can evolve while preserving contract-visible outcomes.

## Testing Expectations
- Run module tests for CRUD/blob/expiry/storage paths.
- Validate file path resolution and namespace isolation across environments.
- Re-check cleanup and list batching behavior after scan/path changes.

Change-triage guidance:
- Path/serialization changes: run read/write compatibility checks against existing on-disk fixtures.
- Blob-flow changes: validate metadata/content pair consistency on create/update/delete paths.
- Scan/batching changes: test large directory behavior and expiry cleanup correctness.

## Risk Areas
- Path or suffix changes can break compatibility with existing persisted data.
- Partial failures in blob/content pair operations can create orphaned artifacts.
- Large directory scans can become performance bottlenecks if batching regresses.
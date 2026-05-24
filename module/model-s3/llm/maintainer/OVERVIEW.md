# Model S3 Maintainer Overview
Maintainer guidance for S3 object-store model and blob behavior.

## Ownership
- S3 CRUD/blob/expiry/storage provider implementation.
- S3 config finalization and credential resolution behavior.
- Multipart upload, range-read, and signed URL paths.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- README.md
- support/

## Integration Boundaries
- Depends on @travetto/model contracts and runtime utilities.
- Uses AWS SDK S3 client and presigner behavior.
- Integrates with DI/config/runtime lifecycle for startup and environment handling.

Compatibility boundaries:
- Key-resolution and metadata mapping behavior are data-compatibility boundaries.
- Signed URL and ranged-read semantics are externally visible and semver-sensitive.

## Invariants
- Key-resolution and namespacing behavior must remain stable.
- Blob metadata and content handling must stay consistent across upload/read/update paths.
- Expiry-aware model reads must continue to filter expired records.
- Multipart behavior must preserve content integrity and cleanup on failure.

## Extension Points
- `S3ModelConfig` can be extended additively for extra client config.
- Service can be wrapped/replaced via DI while preserving contract behavior.
- Internal upload/read logic can evolve as long as API behavior remains stable.

## Testing Expectations
- Run module tests for CRUD/blob/storage/expiry behavior.
- Validate multipart uploads, signed URLs, and range reads.
- Recheck local endpoint compatibility after config or client changes.

Change-triage guidance:
- Upload-path changes: run multipart create/abort/complete and integrity checks together.
- Config changes: validate endpoint, credential, and namespace override precedence.
- Key-schema changes: verify backward compatibility and lifecycle cleanup behavior.

## Risk Areas
- Credentials/config changes can break runtime connectivity.
- Multipart failure handling can leak partial upload state.
- Key-schema changes can orphan existing data.
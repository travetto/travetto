# Model S3 Instructions
How to use the S3-backed model provider reliably.

## Setup
1. Install @travetto/model-s3.
2. Configure `model.s3` with bucket, region, endpoint, and credentials.
3. Resolve `S3ModelService` via DI.

## Usage Workflow
- Use CRUD methods for model documents and blob methods for binary payloads.
- Use multipart upload paths for large content.
- Use range reads and metadata APIs when serving partial content.
- Keep expiry semantics explicit if models define expiration fields.

Minimal pattern:
1. Centralize S3 config finalization and provider wiring.
2. Separate document CRUD and blob workflows in repository/service adapters.
3. Validate multipart upload and signed URL flows in integration tests.

## Safe Defaults
- Keep credentials out of source-controlled config; use env/credential providers.
- Use namespacing for environment isolation.
- Bound list and lifecycle operations for large buckets.
- Keep endpoint and bucket config explicit in local/dev/prod deployment profiles.
# Model S3 Maintainer Instructions

## Change Strategy
- Keep provider behavior aligned to model/blob/storage contracts.
- Treat key resolution, metadata mapping, and multipart handling as high-stability surfaces.
- Prefer additive config changes.

## Implementation Notes
- Re-test multipart create/abort/complete flows when touching upload logic.
- Keep signed URL and range-read behavior consistent with metadata expectations.
- Validate expiry behavior when updating CRUD paths.

## Validation
- Run module tests and representative object-store integration flows.
- Verify list/delete lifecycle behavior on namespaced buckets.
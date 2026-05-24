# Web Upload Maintainer Instructions

## Change Strategy
- Preserve `@Upload` binding behavior for existing endpoints.
- Keep multipart parsing deterministic and robust.
- Prefer additive upload features over semantic rewrites.

## Implementation Notes
- Keep parser-to-parameter mapping explicit and test-backed.
- Avoid hidden behavior around file grouping and naming.
- Ensure upload failures produce actionable error paths.

## Validation
- Run module tests for upload parsing and parameter injection.
- Validate malformed multipart payload behavior.
- Recheck one endpoint integration flow with real multipart input.

## Regression Checklist
- Upload binding remains compatible.
- Multipart parse behavior remains stable.
- Error paths remain predictable.

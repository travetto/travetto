# OpenAPI Maintainer Instructions

## Change Strategy
- Preserve deterministic generation and stable component/path naming.
- Keep source metadata as truth; avoid introducing parallel rule systems.
- Prefer additive output/config enhancements over structural rewrites.

## Implementation Notes
- Keep visitor traversal rules explicit and test-backed.
- Recheck web/schema metadata assumptions when upgrading dependent modules.
- Ensure output serializers preserve stable ordering where tooling depends on diffs.

## Validation
- Run module tests covering generation from representative controllers/schemas.
- Diff generated specs against known fixtures for compatibility-sensitive changes.
- Validate downstream tool consumption where practical (docs/client generation).

## Regression Checklist
- Operation/path/component structure remains compatible for existing APIs.
- Config-driven output behavior remains predictable across environments.
- Schema/type mapping remains stable for common and nested payloads.

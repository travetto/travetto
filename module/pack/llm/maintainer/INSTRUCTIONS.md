# Pack Maintainer Instructions

## Change Strategy
- Preserve backward-compatible CLI defaults when possible.
- Keep artifact layout deterministic.
- Prefer additive flags/behaviors over default-breaking changes.

## Implementation Notes
- Keep bundler env contracts explicit.
- Ensure manifest/resource generation remains aligned with runtime expectations.
- Isolate docker-specific behavior from core pack flow.

## Validation
- Run tests for pack command variants and option parsing.
- Validate generated outputs can execute/deploy.
- Recheck ejected script correctness across platforms.

## Regression Checklist
- CLI behavior remains stable.
- Artifact structure remains compatible.
- Runtime startup from packaged outputs remains functional.

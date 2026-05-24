# Eslint Maintainer Instructions

## Change Strategy
- Preserve registered-config compatibility for existing projects.
- Keep CLI command behavior stable for local/CI tooling.
- Prefer additive plugin contract evolution.

## Implementation Notes
- Keep generation templates explicit and test-backed.
- Ensure command output remains actionable for editor/CI integration.
- Avoid hidden assumptions about workspace output layout.

## Validation
- Run module tests for config generation and lint invocation paths.
- Validate generated config in both local and CI-like contexts.
- Recheck one representative custom plugin rule path.

## Regression Checklist
- Config registration output remains compatible.
- Lint command behavior remains deterministic.
- Plugin loading/contract behavior remains stable.

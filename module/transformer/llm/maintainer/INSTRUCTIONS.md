# Transformer Maintainer Instructions

## Change Strategy
- Preserve stable registration APIs and naming conventions.
- Keep transforms deterministic and reproducible.
- Prefer additive capabilities over behavior-altering defaults.

## Implementation Notes
- Isolate TypeScript API version-sensitive logic.
- Keep node factory interactions explicit and test-backed.
- Enforce opt-in and idempotency expectations.

## Validation
- Run transformer tests and representative consuming module builds.
- Compare emitted output for regressions.
- Recheck monorepo compile behavior for deterministic output.

## Regression Checklist
- Registration APIs remain compatible.
- Emitted output remains semantically stable.
- Repeated compile runs produce equivalent results.

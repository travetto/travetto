# Web Aws Lambda Maintainer Instructions

## Change Strategy
- Preserve adapter semantics for existing deployed lambdas.
- Keep event mapping logic explicit and predictable.
- Prefer additive support for new event variants.

## Implementation Notes
- Keep request context translation deterministic.
- Ensure response serialization remains Lambda-compatible.
- Avoid hidden assumptions tied to one API Gateway flavor only.

## Validation
- Run module tests for adapter behavior.
- Validate at least one end-to-end lambda invocation path.
- Confirm packaging entrypoint compatibility with pack tooling.

## Regression Checklist
- Event mapping remains stable.
- Response mapping remains correct.
- Packaging/startup integration remains functional.

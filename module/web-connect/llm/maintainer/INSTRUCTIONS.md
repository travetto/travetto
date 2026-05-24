# Web Connect Maintainer Instructions

## Change Strategy
- Preserve bridge compatibility for existing middleware integrations.
- Keep limitation boundaries explicit and documented.
- Prefer additive compatibility improvements over semantic rewrites.

## Implementation Notes
- Keep adaptation and invocation code paths explicit and test-backed.
- Avoid hidden behavior that implies full Node request/response parity.
- Ensure errors are mapped predictably into framework flows.

## Validation
- Run module tests for invocation and adaptation behavior.
- Validate one representative Passport/connect integration path.
- Recheck callback and async failure scenarios.

## Regression Checklist
- Invocation behavior remains deterministic.
- Adaptation boundaries remain stable.
- Integration compatibility remains intact.

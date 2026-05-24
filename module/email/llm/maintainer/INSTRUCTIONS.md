# Email Maintainer Instructions

## Change Strategy
- Preserve send contract semantics across transport implementations.
- Keep template lookup behavior explicit and deterministic.
- Prefer additive config/option evolution.

## Implementation Notes
- Keep transport invocation and error handling paths clearly separated.
- Avoid hidden fallback behavior for missing template assets.
- Maintain stable option defaults for existing senders.

## Validation
- Run module tests for direct and template send paths.
- Validate one concrete transport integration path.
- Recheck missing-template and transport-failure behavior.

## Regression Checklist
- Send contract behavior remains compatible.
- Template key lookup behavior remains stable.
- Transport substitution remains deterministic.

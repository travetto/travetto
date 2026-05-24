# Auth Web Session Maintainer Instructions

## Change Strategy
- Preserve interceptor ordering and lifecycle semantics.
- Keep context exposure stable for existing endpoint injection paths.
- Prefer additive integration behavior over lifecycle rewrites.

## Implementation Notes
- Keep load/persist logic paired in finally-safe control flow.
- Ensure context-source registration remains request-scoped.
- Avoid duplicate persistence triggers from overlapping interceptors.

## Validation
- Run module tests for authenticated session request flows.
- Validate context param and injected session context behavior.
- Recheck failure-path cleanup and persistence consistency.

## Regression Checklist
- Interceptor ordering remains correct.
- Session exposure and persistence remain deterministic.
- Request-scoped isolation remains intact.

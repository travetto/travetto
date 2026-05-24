# Auth Session Maintainer Instructions

## Change Strategy
- Preserve session lifecycle semantics and request-scoped behavior.
- Keep storage/expiry compatibility with existing session records.
- Prefer additive session data evolution.

## Implementation Notes
- Keep load/persist logic idempotent where possible.
- Ensure destroy/logout paths clear state deterministically.
- Avoid hidden writes outside service boundaries.

## Validation
- Run module tests for session lifecycle and expiry behavior.
- Validate concurrent authenticated request scenarios.
- Recheck one downstream auth-web-session integration flow.

## Regression Checklist
- Load/persist ordering remains stable.
- Expiry behavior remains predictable.
- Context/session isolation remains correct.

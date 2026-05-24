# Auth Model Maintainer Instructions

## Change Strategy
- Preserve model/principal mapping semantics for existing records.
- Keep credential utilities deterministic and backward compatible.
- Prefer additive service behavior over contract rewrites.

## Implementation Notes
- Keep mapping functions explicit and test-backed.
- Avoid leaking password/reset fields into unrelated model workflows.
- Ensure auth errors remain typed and actionable.

## Validation
- Run module tests for auth-model register/authenticate/reset behavior.
- Validate compatibility using pre-existing hashed credentials.
- Recheck integration with one downstream auth flow.

## Regression Checklist
- Mapping semantics remain stable.
- Hash/salt/reset-token behavior remains compatible.
- Auth failure and success pathways remain deterministic.

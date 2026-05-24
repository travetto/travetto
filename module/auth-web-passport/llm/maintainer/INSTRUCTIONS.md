# Auth Web Passport Maintainer Instructions

## Change Strategy
- Preserve stable strategy-to-principal mapping behavior.
- Keep authenticator integration aligned with auth-web lifecycle expectations.
- Prefer additive provider support over behavior rewrites.

## Implementation Notes
- Keep callback and failure behavior explicit and test-backed.
- Avoid leaking provider-specific semantics into core principal contracts.
- Treat adapter and middleware assumptions as compatibility-sensitive.

## Validation
- Run module tests for strategy adaptation flows.
- Validate at least one real strategy integration path.
- Recheck auth-web endpoint behavior for login/callback/logout routes.

## Regression Checklist
- Authenticate/callback flow remains deterministic.
- Principal mapping remains compatible.
- Failure/error behavior remains typed and actionable.

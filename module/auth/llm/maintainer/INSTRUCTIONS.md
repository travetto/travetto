# Auth Maintainer Instructions

## Change Strategy
- Keep contracts minimal, explicit, and backward compatible.
- Separate identity verification from authorization decisions.

## Implementation Notes
- Avoid framework-transport coupling in core auth contracts.
- Maintain clear error typing for auth failure states.
- Keep principal payload semantics stable.

## Validation
- Validate authenticator/authorizer integration paths.
- Verify token parsing/verification edge cases.

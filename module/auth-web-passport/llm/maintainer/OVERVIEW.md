# Auth Web Passport Maintainer Overview
Maintainer guidance for passport strategy adaptation and auth-web integration behavior.

## Ownership
- Passport strategy adaptation into authenticator contract.
- Callback flow integration and principal mapping boundaries.
- Compatibility with auth-web login and context behavior.

## High-Signal Entry Points
- src/authenticator.ts
- src/types.ts
- support/

## Integration Boundaries
- Depends on passport strategy contracts and auth-web integration points.
- Behavior may vary with transport adapter constraints.

## Compatibility Boundaries
- Mapping semantics from strategy payload to principal are semver-sensitive.
- Authenticator behavior for multi-step/callback flows is externally visible.

## Testing Expectations
- Validate strategy success/failure/callback paths.
- Validate principal mapping compatibility for existing consumers.
- Recheck behavior under web adapter environments in use.

## Change-Triage Guidance
- Adapter changes: verify authenticate flow and callback completion behavior.
- Mapping changes: validate principal contract compatibility and downstream authorization.
- Integration changes: test auth-web decorator flows with strategy-backed routes.

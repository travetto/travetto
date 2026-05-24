# Auth Model Maintainer Overview
Maintainer guidance for model-auth integration contracts and credential lifecycle behavior.

## Ownership
- `ModelAuthService` authentication/registration orchestration.
- `RegisteredPrincipal` contract compatibility.
- Password hash/salt/reset-token utilities and persistence coordination.

## High-Signal Entry Points
- src/service.ts
- src/model.ts
- src/util.ts

## Integration Boundaries
- Depends on @travetto/auth contracts and model CRUD capabilities.
- Consumed by auth-web and application auth flows needing local user persistence.

## Compatibility Boundaries
- Principal/model mapping behavior is semver-sensitive.
- Password hash/salt/reset token semantics affect existing stored identities.

## Testing Expectations
- Validate register/authenticate/update-password/reset workflows.
- Validate mapping compatibility with representative user model shapes.
- Recheck hash/verification behavior for existing credentials.

## Change-Triage Guidance
- Mapping changes: run backward-compatibility tests on persisted identities.
- Service-flow changes: verify auth failure categories and success paths.
- Utility changes: test hash generation and verification determinism.

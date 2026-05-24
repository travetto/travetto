# Auth Maintainer Overview
Maintainer guidance for @travetto/auth contracts and context orchestration.

## Ownership
- Authenticator and authorizer contract definitions.
- Principal and token type stability.
- Auth service and context behavior.

## High-Signal Entry Points
- src/service.ts
- src/context.ts
- src/types/authenticator.ts
- src/types/authorizer.ts
- src/types/principal.ts
- src/types/token.ts

## Integration Boundaries
- Shared foundation for auth-web and session/passport integration modules.
- Contract stability is critical for downstream auth providers.

## Compatibility Boundaries
- Principal/token shape and AuthService/AuthContext behavior are semver-sensitive shared contracts.
- Authenticator/authorizer interface expectations are externally consumed by multiple integration modules.

## Testing Expectations
- Validate authenticator-authorizer orchestration and request-scoped context behavior.
- Recheck token parsing/verification edge cases and typed auth error paths.
- Validate compatibility with at least one downstream auth-web/session integration path.

## Change-Triage Guidance
- Contract changes: run compatibility tests for existing provider implementations.
- Context/service changes: verify request-scoped isolation and lifecycle behavior.
- Error-model changes: test endpoint/interceptor consumption and failure-path consistency.

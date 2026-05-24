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

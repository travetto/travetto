# Auth Web Session Maintainer Overview
Maintainer guidance for web-session interceptor integration and context exposure.

## Ownership
- AuthSessionInterceptor lifecycle and ordering behavior.
- Web async context source exposure for session/session-data types.
- Integration consistency between auth-web and auth-session modules.

## High-Signal Entry Points
- src/interceptor.ts
- src/types.ts
- support/

## Integration Boundaries
- Depends on auth-web context initialization and auth-session persistence service.
- Consumed by authenticated endpoints requiring session data injection.

## Compatibility Boundaries
- Interceptor ordering and load/persist behavior are externally visible.
- Session data exposure via context sources is semver-sensitive.

## Testing Expectations
- Validate interceptor dependency ordering with auth context interceptor.
- Validate session data availability and persistence in authenticated requests.
- Recheck destroy/logout behavior across request boundaries.

## Change-Triage Guidance
- Interceptor changes: test load/persist symmetry and error-path cleanup.
- Context-source changes: verify Session/SessionData injection behavior.
- Integration changes: validate auth-web + auth-session combined flows.

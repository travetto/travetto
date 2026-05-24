# Auth Web Overview
The @travetto/auth-web module integrates auth contracts with web request/response flows.

## What This Module Is
This module provides endpoint decorators, auth interceptors, and principal codec behavior for request-scoped authentication in web APIs.

## Why To Use It
- It standardizes login/logout/auth-required endpoint behavior.
- It bridges request context and auth context consistently.
- It supports token/cookie principal transport through codec abstractions.

## When To Use It
- Use when building authenticated HTTP endpoints with @travetto/web.
- Use when principal decoding/encoding should be centralized.
- Use when auth context must be maintained across request lifecycle stages.

## When Not To Use It
- Do not duplicate auth state parsing in every endpoint.
- Do not bypass auth-web decorators/interceptors for regular protected routes.

## Core Capabilities
- Login/logout/auth-required endpoint decoration.
- Principal encoding/decoding via codec contracts.
- Auth context integration within web request lifecycle.
- Multi-step authenticator state support.

## Decorators
- `@Login`: authenticate via one or more configured authenticators.
- `@Authenticated`: require an authenticated principal.
- `@Unauthenticated`: require absence of authenticated principal.
- `@Logout`: clear/deauthenticate current request principal.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `AuthContextInterceptor`: request-to-auth-context bridge.
- `PrincipalCodec` interface and `JWTPrincipalCodec` default implementation.
- `WebAuthConfig` for header/cookie token transport settings.

Decision guideline:
Use decorator and codec contracts as the canonical authentication boundary for web endpoints instead of custom per-route token parsing.

## Typical Integration Flow
1. Register authenticator providers (symbols/factories).
2. Configure principal codec transport behavior.
3. Decorate endpoints with login/authenticated/logout requirements.
4. Access authenticated principal through context-aware endpoint parameters.

## Practical Scenario
For SPA + API login, use `@Login` for credential exchange, keep principal token in configured header/cookie transport, and protect downstream endpoints with `@Authenticated`.

Common pitfalls:
- Implementing custom token parsing in controllers instead of codec boundaries.
- Mixing transport-specific behavior into authenticator logic.
- Changing token/header/cookie config without integration tests.

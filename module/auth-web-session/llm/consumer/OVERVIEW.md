# Auth Web Session Overview
The @travetto/auth-web-session module exposes auth-session state within authenticated web request flows.

## What This Module Is
This module connects auth-web request lifecycle and auth-session persistence by loading session state for authenticated requests and persisting changes at request completion.

## Why To Use It
- It makes session data available directly in web handlers.
- It keeps session lifecycle behavior in interceptor boundaries.
- It avoids duplicate load/persist logic in endpoint code.

## When To Use It
- Use when authenticated web endpoints need durable session data.
- Use when session state should be injectable in request context.
- Use when auth-session persistence must integrate with auth-web context.

## When Not To Use It
- Do not use if your auth flow is fully stateless and sessionless.
- Do not call session load/persist manually in every endpoint when interceptor wiring is available.

## Core Capabilities
- Request-scoped session exposure for authenticated web flows.
- Interceptor-driven session load/persist orchestration.
- Context-param and service-based session data access.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `AuthSessionInterceptor`: auth-web/auth-session lifecycle integration.
- `SessionContext` and `SessionService` access within request scope.
- Web async context source registration for `Session` and `SessionData`.

Decision guideline:
Use auth-web-session interceptor boundaries as the canonical mechanism for session state exposure in web requests.

## Typical Integration Flow
1. Install and configure auth-session and auth-web-session.
2. Ensure session interceptor is active after auth context initialization.
3. Access session data via context params or injected session context.
4. Allow interceptor lifecycle to persist updates safely.

## Practical Scenario
For authenticated account settings endpoints, read session data from context, update request-scoped values as needed, and let interceptor lifecycle persist changes automatically.

Common pitfalls:
- Accessing session data before context interceptor ordering is correct.
- Writing endpoint-level manual persist logic that conflicts with interceptor lifecycle.
- Treating session data as static across requests without refresh/load behavior.

# Auth Session Overview
The @travetto/auth-session module provides model-backed authentication session persistence and lifecycle management.

## What This Module Is
This module bridges auth context with durable session storage using model expiry-capable providers.

## Why To Use It
- It centralizes load/read-modify/persist session behavior.
- It supports expiry-aware session records.
- It keeps session lifecycle logic out of endpoint code.

## When To Use It
- Use when authenticated requests need server-side session data.
- Use when session state must survive beyond a single request.
- Use when you need explicit session persistence integrated with auth context.

## When Not To Use It
- Do not use for purely stateless token-only workflows.
- Do not mutate session storage directly without session service boundaries.

## Core Capabilities
- Auth-session integration with model expiry support.
- Session load/persist orchestration.
- Request-scoped session context access.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `SessionService`: load/persist/session lifecycle orchestration.
- `SessionContext`: request-scoped session access.
- `Session` and `SessionData` types for session content shape.

Decision guideline:
Use session service boundaries (`load` then mutate then `persist`) as the canonical lifecycle for server-side auth session state.

## Typical Integration Flow
1. Configure auth-session with a model expiry-capable provider.
2. Load session data at authenticated request boundaries.
3. Read/update session data through context/service APIs.
4. Persist session changes at request completion.

## Practical Scenario
For a multi-step authenticated workflow, load session data once per request, store intermediate state in session data, and rely on expiry-aware persistence for cleanup.

Common pitfalls:
- Writing directly to backing storage and bypassing session lifecycle checks.
- Forgetting persist timing and losing updates.
- Using providers without proper expiry support for long-lived sessions.

# Auth Web Session Instructions
How to use session-aware auth in web requests.

## Setup
1. Install @travetto/auth-web-session with @travetto/auth-web and @travetto/auth-session.
2. Ensure session interceptor depends on auth context interceptor ordering.
3. Configure session provider with expiry-capable model storage.

## Usage Workflow
- Access session data through `SessionContext`, `SessionData`, or context parameters.
- Keep session modifications within authenticated request boundaries.
- Rely on interceptor lifecycle for load/persist.

Minimal pattern:
1. Authenticate request.
2. Load session via interceptor.
3. Read/write session data in endpoint/service.
4. Persist via interceptor teardown.

## Safe Defaults
- Keep session payload compact and explicit.
- Keep session mutation logic centralized.
- Keep interceptor ordering stable across auth/web integrations.

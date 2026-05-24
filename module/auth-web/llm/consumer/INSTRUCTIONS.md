# Auth Web Instructions
How to implement authenticated web endpoints safely.

## Setup
1. Install @travetto/auth-web and configure at least one authenticator provider.
2. Configure principal transport mode (header or cookie).
3. Ensure auth-web interceptors are active in your web stack.

## Usage Workflow
- Use `@Login` for authentication entrypoints.
- Use `@Authenticated` / `@Unauthenticated` for route access control.
- Use `@Logout` for explicit deauthentication flows.
- Access principal and auth state through context-aware APIs.

Minimal pattern:
1. Define auth endpoints and apply decorators.
2. Keep principal codec/transport centralized.
3. Keep authorization checks explicit after authentication.

## Safe Defaults
- Keep token payload minimal and time-bounded.
- Keep header/cookie behavior explicit per environment.
- Keep multi-step authenticator state isolated to auth context.

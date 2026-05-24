# Auth Overview
The @travetto/auth module defines core authentication and authorization contracts and context handling.

## Primary Capabilities
- Principal and token abstractions.
- Authenticator and authorizer contracts.
- Request-scoped auth context handling.
- Shared auth error and state modeling.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core Consumer APIs
- AuthService: primary auth service orchestration.
- AuthContext: request-scoped principal context.
- Authenticator / Authorizer interfaces: extension points for identity and permission checks.
- Principal and token types: shared auth model contracts.

## When to use it
Use this module when implementing authentication flows, principal modeling, or authorization checks in framework-native services.

# Auth Overview
The @travetto/auth module defines core authentication and authorization contracts and context handling.

## What This Module Is
This module is the core identity and permission contract layer for authentication and authorization workflows.

## Why To Use It
- It standardizes principal shape and auth lifecycle concepts.
- It cleanly separates authentication from authorization concerns.
- It provides shared context/state mechanisms for request-scoped auth behavior.

## When To Use It
- Use when implementing login/session/token-based identity flows.
- Use when services need framework-standard principal/permission handling.
- Use when composing multiple authenticators or authorizers.

## When Not To Use It
- Do not hardcode auth state in unrelated modules.
- Do not conflate identity verification and permission resolution in one opaque service.

## Core Capabilities
- Principal and token abstractions.
- Authenticator and authorizer contracts.
- Request-scoped auth context handling.
- Shared auth error and state modeling.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- AuthService: primary auth service orchestration.
- AuthContext: request-scoped principal context.
- Authenticator / Authorizer interfaces: extension points for identity and permission checks.
- Principal and token types: shared auth model contracts.

## Typical Integration Flow
1. Define a principal contract suitable for your domain.
2. Implement one or more authenticators for credential verification.
3. Implement authorizers for permission enrichment/enforcement.
4. Store active auth state in AuthContext via AuthService.

## Practical Scenario
For SSO plus internal role checks, authenticate with external identity and run authorizers to attach product-specific permissions before endpoint access.


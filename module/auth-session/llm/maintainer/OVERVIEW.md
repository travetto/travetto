# Auth Session Maintainer Overview
Maintainer guidance for auth session persistence and lifecycle behavior.

## Ownership
- Session service load/persist orchestration.
- Session context behavior and request-scoped access.
- Expiry-aware session storage integration with model providers.

## High-Signal Entry Points
- src/service.ts
- src/context.ts
- src/session.ts

## Integration Boundaries
- Depends on @travetto/auth context and model expiry-capable storage.
- Consumed by auth-web-session and authenticated endpoint workflows.

## Compatibility Boundaries
- Session record shape and expiry semantics are semver-sensitive.
- Service lifecycle behavior (load/persist/destroy) is externally visible.

## Testing Expectations
- Validate load/persist/destroy behavior under normal and error flows.
- Validate expiry behavior and stale-session handling.
- Recheck integration with auth-web-session interception paths.

## Change-Triage Guidance
- Lifecycle changes: test request boundary behavior and data durability.
- Storage changes: validate expiry and record compatibility.
- Context changes: verify request-scoped isolation across concurrent requests.

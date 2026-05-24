# Web Connect Maintainer Overview
Maintainer guidance for request/response bridge behavior and middleware compatibility boundaries.

## Ownership
- Connect-style middleware invocation bridge.
- Request/response adaptation semantics and lifecycle handling.
- Compatibility guarantees and limitation boundaries.

## High-Signal Entry Points
- src/util.ts
- src/types.ts
- support/

## Integration Boundaries
- Consumed by modules needing connect middleware compatibility (notably auth integrations).
- Depends on @travetto/web request lifecycle contracts.

## Compatibility Boundaries
- Adapter request/response semantics are externally visible integration contracts.
- Limitation boundaries (EventEmitter/socket behavior) are semver-sensitive expectations.

## Testing Expectations
- Validate middleware invocation success/failure paths.
- Validate bridge behavior for callback and promise-like middleware patterns.
- Recheck compatibility with auth-web-passport integration scenarios.

## Change-Triage Guidance
- Adapter changes: verify middleware compatibility assumptions.
- Error handling changes: validate propagation into framework failure contracts.
- Type changes: ensure integration modules compile and run unchanged.

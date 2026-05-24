# Email Nodemailer Maintainer Overview
Maintainer guidance for nodemailer adapter behavior and transport compatibility.

## Ownership
- Nodemailer transport adapter implementation.
- Option passthrough and transport initialization behavior.
- Error behavior alignment with framework email contracts.

## High-Signal Entry Points
- src/transport.ts
- src/types.ts
- support/

## Integration Boundaries
- Consumed by @travetto/email as a concrete transport implementation.
- Depends on nodemailer transport option semantics and provider behavior.

## Compatibility Boundaries
- Transport contract behavior and option mapping are semver-sensitive.
- Error propagation and send result semantics are externally visible.

## Testing Expectations
- Validate send flows across representative transport modes.
- Validate option mapping compatibility for known providers.
- Recheck error behavior for auth/connectivity failures.

## Change-Triage Guidance
- Adapter changes: verify framework transport contract compatibility.
- Option changes: test provider-specific config scenarios.
- Error handling changes: validate failure categories and retry expectations.

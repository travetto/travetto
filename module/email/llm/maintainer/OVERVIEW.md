# Email Maintainer Overview
Maintainer guidance for transport abstraction, template send behavior, and email runtime integration.

## Ownership
- Email service send orchestration.
- Transport contract behavior and default implementation.
- Template-key asset lookup and send-path behavior.

## High-Signal Entry Points
- src/service.ts
- src/types.ts
- src/config.ts
- src/transport.ts

## Integration Boundaries
- Consumed by email-compiler and concrete transport modules.
- Depends on DI wiring for transport selection.

## Compatibility Boundaries
- `EmailOptions` and transport contract semantics are semver-sensitive.
- Template-key lookup behavior and required asset expectations are externally visible.

## Testing Expectations
- Validate direct send and template send paths.
- Validate null-transport and custom transport substitution behavior.
- Recheck error behavior for missing template assets and transport failures.

## Change-Triage Guidance
- Transport contract changes: validate downstream transport adapters.
- Template resolution changes: test compiled artifact path compatibility.
- Service-flow changes: verify failure categories and observability hooks.

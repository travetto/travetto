# Async Context Maintainer Overview
Maintainer guidance for async local propagation guarantees and context lifecycle behavior.

## Ownership
- Async context activation and propagation semantics.
- Typed context value wrappers and key management.
- Error/strictness behavior for missing context access.

## High-Signal Entry Points
- src/context.ts
- src/decorator.ts
- src/value.ts

## Integration Boundaries
- Consumed by modules that require request/operation scoped state propagation.
- Relies on Node async context behavior and framework decorator boundaries.

## Compatibility Boundaries
- Propagation semantics across promise/callback boundaries are externally visible.
- @WithAsyncContext and AsyncContextValue behavior is semver-sensitive.

## Testing Expectations
- Validate propagation across nested async boundaries.
- Validate strict/missing-context behavior paths.
- Recheck integration with at least one downstream request-scoped consumer.

## Change-Triage Guidance
- Propagation changes: test async edge cases (parallel tasks, nested contexts).
- Decorator changes: verify activation boundaries and lifecycle consistency.
- Value wrapper changes: validate typed get/set behavior and error paths.

# Transformer Maintainer Overview
Maintainer guidance for transformer orchestration, AST API usage, and idempotent compile-time behavior.

## Ownership
- Transformer registration and execution flow.
- Shared transformer state/factory utilities.
- Conventions for transformer discovery and application.

## High-Signal Entry Points
- src/
- support/transformer.* conventions
- handler/state utility definitions

## Integration Boundaries
- Integrates with compiler/manifest build processes.
- Consumed by framework modules implementing compile-time transforms.

## Compatibility Boundaries
- Transformer APIs and registration semantics are externally visible.
- Behavior changes can cascade across multiple framework modules.

## Testing Expectations
- Validate handler execution ordering and node targeting.
- Validate idempotency across repeated and monorepo builds.
- Validate output compatibility for representative transformer consumers.

## Change-Triage Guidance
- API changes: assess downstream transformer breakage risk.
- State/factory changes: inspect emitted AST/output regressions.
- Discovery changes: verify transformer loading and opt-in semantics.

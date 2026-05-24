# Async Context Maintainer Instructions

## Change Strategy
- Preserve predictable propagation semantics across async boundaries.
- Keep decorator activation behavior explicit and backward compatible.
- Prefer additive context/value features over altering existing key semantics.

## Implementation Notes
- Keep context activation and retrieval paths simple and test-backed.
- Avoid hidden fallbacks that mask missing-context errors.
- Ensure nested context behavior is deterministic and isolated.

## Validation
- Run module tests for propagation and strictness behavior.
- Validate representative nested/parallel async workflows.
- Recheck one downstream consumer that relies on request-scoped context.

## Regression Checklist
- Context propagation remains stable under nested async flows.
- Missing-context handling remains explicit and predictable.
- Typed context values remain backward compatible.

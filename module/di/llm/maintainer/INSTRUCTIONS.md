# DI LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Preserve deterministic resolution and error behavior.
- Keep registration and injection semantics backward compatible.
- Prefer explicitness over hidden resolution heuristics.

## Registration and Resolution Changes

1. Update decorator metadata behavior in src/decorator.ts.
2. Keep registry selection rules clear and test-backed.
3. Ensure qualifier/target interactions remain predictable.

## Factory and Lifecycle

- Validate factory return type compatibility with target.
- Keep optional injection behavior explicit and non-throwing unless required.
- Avoid side effects during dependency graph construction.

## Validation Expectations

- Add tests for default target selection and qualifier overrides.
- Add failure-path tests for missing dependencies and ambiguous matches.
- Add lifecycle tests when touching construction order or caching.

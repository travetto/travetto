# Maintainer Notes

## Module Role
This module owns LLM-oriented generation guidance for Travetto.

## Implementation Rules
- Keep operation metadata explicit and testable.
- Track excluded operations in `src/recommendation.ts`.
- Keep install/workflow guidance focused on direct generation workflows.
- Avoid provider-specific integrations in this phase.

## Framework Principles
- Treat llm-support as framework guidance infrastructure, not app-specific scaffolding.
- Preserve stable public contracts (operation ids, tool names, output shapes) unless a versioned compatibility change is planned.
- Keep guidance declarative and data-driven when possible to reduce execution branching and drift.
- Favor explicit policy over convention: codify exclusions, defaults, and verification expectations in source.

## Engineering Best Practices
- Use schema classes for boundary contracts and runtime validation.
- Keep recommendations explainable: each operation should have intent, dependency rationale, and verification guidance.
- Maintain deterministic execution planning and artifact reporting for traceability.
- Prefer additive evolution of guidance catalogs and workflows over mutation of existing semantics.
- Ensure every new capability has at least one integrity test (metadata shape, discoverability, or execution coverage).
- Keep documentation synchronized with behavior changes in the same change set.

## Compatibility And Change Discipline
- Breaking contract changes require an explicit compatibility note and migration guidance.
- New operations should avoid overlapping semantics unless distinction is documented.
- Excluded operations must remain visible in policy/tests, even when omitted from default recommendations.
- Guidance should remain monorepo-aware and avoid assumptions that only apply to single-package apps.

## Catalog Evolution
When adding operations:
1. Add type-safe operation metadata.
2. Add workflow/install entries if module dependencies change.
3. Add/update tests for filtering and exclusion behavior.
4. Update consumer instructions if scope changes.
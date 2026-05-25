# Maintainer Notes

## Module Role
This module owns LLM-oriented generation guidance for Travetto.

## Implementation Rules
- Keep operation metadata explicit and testable.
- Track excluded operations in `src/recommendation.ts`.
- Keep install/workflow guidance focused on direct generation workflows.
- Avoid provider-specific integrations in this phase.

## Catalog Evolution
When adding operations:
1. Add type-safe operation metadata.
2. Add workflow/install entries if module dependencies change.
3. Add/update tests for filtering and exclusion behavior.
4. Update consumer instructions if scope changes.
# Model Query Maintainer Instructions

## Change Strategy
- Keep the DSL stable and additive.
- Separate type-system evolution from execution-specific provider behavior.
- Treat verifier changes as public behavior changes, not internal cleanup.

## Implementation Notes
- Update `QueryVerifier` together with any new operator or clause semantics.
- Preserve the distinction between basic query support and optional crud, facet, and suggest layers.
- Keep helper utilities schema-aware and provider-agnostic.

## Validation
- Run the relevant support suites plus one concrete provider integration suite.
- Recheck nested-field validation, operator typing, and singular-result handling after edits.
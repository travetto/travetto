# Model Query Maintainer Overview
Maintainer guidance for the typed query DSL, validator, and query-support contracts.

## Ownership
- Query object types and operator vocabulary.
- Query-capable provider interfaces for reads, bulk mutation, facets, and suggestions.
- Shared verifier and utility behavior used by providers.

## High-Signal Entry Points
- src/model/query.ts
- src/model/where-clause.ts
- src/types/query.ts
- src/types/crud.ts
- src/types/facet.ts
- src/types/suggest.ts
- src/util/
- src/verifier.ts
- support/test/

## Integration Boundaries
- Depends on @travetto/model for model metadata and base contracts.
- Depends on @travetto/schema for structural validation through `QueryVerifier`.
- Implemented by provider modules such as model-mongo, model-sql, and model-elasticsearch.

Compatibility boundaries:
- Query type shapes and operator names are shared API and must be treated as semver-sensitive.
- `QueryVerifier` accepted/rejected behavior is externally visible and should be treated as a user-facing contract.

## Invariants
- The query DSL must stay typed against model fields and field shapes.
- Clause validation must reject unknown members and invalid operator/type combinations.
- Expiry-aware and polymorphic helper behavior must remain compatible with core model and schema semantics.
- Optional support traits must stay composable without forcing providers into unsupported operations.

## Extension Points
- Providers can implement only the support interfaces they truly support.
- Shared utilities may grow additively, but existing query shapes and operator expectations are compatibility-sensitive.
- Support tests are the contract for new provider implementations.

## Testing Expectations
- Run support tests for query, crud, facet, suggest, and polymorphism paths as applicable.
- Revalidate verifier behavior whenever operator rules, field traversal, or nested clause handling changes.
- Check at least one concrete provider after shared utility or type changes.

Change-triage guidance:
- Verifier/operator changes: run support suites plus at least one SQL-like and one document-like provider integration.
- Type-level changes: run compile checks across provider modules and query-language integration.
- Helper changes (`ModelQueryUtil`, suggest/facet/crud utils): verify expiry and polymorphism helper behavior explicitly.

## Risk Areas
- Operator-rule changes can break multiple backends at once.
- Nested object and array traversal is easy to regress in both typing and verification.
- Query-driven mutation helpers can become dangerous if validation and execution semantics drift apart.
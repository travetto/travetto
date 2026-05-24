# Model Query Overview
The @travetto/model-query module defines Travetto’s typed query language and the provider contracts that execute it.

## What This Module Is
This module adds advanced querying, bulk query-driven mutations, faceting, suggestion helpers, and validation utilities on top of the base model contracts.

## Why To Use It
- It gives applications a consistent query DSL across multiple model providers.
- It supports more expressive filtering than computed indexes alone.
- It separates optional feature tiers so providers can expose only the query capabilities they actually implement.

## When To Use It
- Use it when you need `where`, `sort`, `select`, `limit`, or `offset` style querying.
- Use it for bulk updates or deletes constrained by a typed query.
- Use it for facets and type-ahead style suggestion flows.

## When Not To Use It
- Do not use it for a simple deterministic lookup that fits a computed index; `model-indexed` is usually simpler there.
- Do not assume every model provider implements every query-related support interface.
- Do not treat the DSL as a direct pass-through to one backend’s native query syntax.

## Core Capabilities
- Typed query objects through `Query`, `ModelQuery`, and `PageableModelQuery`.
- Query execution contracts through `ModelQuerySupport`.
- Optional bulk mutation, facet, and suggest contracts through `ModelQueryCrudSupport`, `ModelQueryFacetSupport`, and `ModelQuerySuggestSupport`.
- Shared verification and utility helpers for query-aware provider code.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
- `ModelQueryUtil`: support detection, single-result verification, expiry-aware where construction, and polymorphic query helpers.
- `ModelQueryCrudUtil`: support detection plus expired-record bulk deletion helper.
- `ModelQueryFacetUtil`: support detection for query faceting.
- `ModelQuerySuggestUtil`: support detection, suggest-query construction, regex creation, and result combination helpers.
- `QueryVerifier`: schema-aware validation for `where`, `select`, and `sort` clauses.

## Core APIs and Extension Points
- `ModelQuerySupport` provides `query`, `queryOne`, and `queryCount`.
- `ModelQueryCrudSupport` adds `updateByQuery`, `updatePartialByQuery`, and `deleteByQuery`.
- `ModelQueryFacetSupport` adds `facetByQuery`.
- `ModelQuerySuggestSupport` adds `suggestByQuery` and `suggestValuesByQuery`.

Decision guideline:
If users can shape filters at runtime, use `model-query`. If the access path is fixed and deterministic, prefer `model-indexed` for simpler contracts and lower ambiguity.

## Typical Integration Flow
1. Define persisted models with @travetto/model.
2. Choose a backend that implements the query contracts you need.
3. Build typed query objects using `where`, `sort`, `select`, `limit`, and `offset`.
4. Use `QueryVerifier` or provider utilities to validate and normalize query input before execution.

## Practical Scenario
For an admin search screen, issue a query that filters active users by organization, sorts by creation date, and pages results. Add `facetByQuery` on role to drive filter counts, and use `suggestByQuery` on the email field to power type-ahead search. The UI logic stays on the shared DSL even if the underlying provider changes.

Common pitfalls:
- Passing arbitrary user clauses directly to providers without verification or field restrictions.
- Treating provider-specific behavior as guaranteed by the shared query contracts.
- Mixing singular (`queryOne`) and list-query semantics in endpoints without explicit expectations.
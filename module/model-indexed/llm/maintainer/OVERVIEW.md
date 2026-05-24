# Model Indexed Maintainer Overview
Maintainer guidance for @travetto/model-indexed contracts, computation rules, and provider integration boundaries.

## Ownership
- Computed index descriptor types and registration helpers.
- Shared index-body typing, paging types, and indexed service contracts.
- Provider-facing utility behavior and computed key/sort extraction semantics.

## High-Signal Entry Points
- src/indexes.ts
- src/computed.ts
- src/types/indexes.ts
- src/types/service.ts
- src/util.ts
- support/test/

## Integration Boundaries
- Depends on @travetto/model for model metadata and index registration.
- Consumed by provider modules such as model-memory and any backend implementing `ModelIndexedSupport`.
- Must remain consistent with provider-specific test suites and index error behavior.

Compatibility boundaries:
- Index body typing (`FullKeyedIndexBody`, `FullKeyedIndexWithPartialBody`) is part of consumer-facing API shape.
- `ModelIndexedSupport` method names and argument contracts are shared by multiple providers and should be treated as semver-sensitive.

## Invariants
- Index registration must preserve exact key and sort templates derived from user input.
- Missing required fields during computation must remain a validation failure unless an explicit empty-value strategy is supplied.
- `uniqueIndex` semantics must continue to mean duplicate computed keys are rejected by supporting providers.
- Sorted index sort extraction must keep ascending and descending intent intact.

## Extension Points
- New providers implement `ModelIndexedSupport` and can use `ModelIndexedComputedIndex` plus `ModelIndexedUtil` as shared building blocks.
- Shared helpers may expand additively, but method names and body shapes on `ModelIndexedSupport` are compatibility-sensitive.

## Testing Expectations
- Validate index registration and retrieval behavior through support tests.
- Cover missing-key failures, unique-key collisions, sorted paging, and suggestion behavior.
- Run at least one concrete provider integration suite after changing computation or contract types.

Change-triage guidance:
- If a change touches template parsing or computed key/sort extraction, run indexed suites plus at least one memory and one non-memory provider integration.
- If a change touches service type signatures only, run compile-time checks across provider modules and support tests.
- If a change touches warnings for unsupported index types, validate startup logs in at least one provider with mixed index declarations.

## Risk Areas
- Changes to template parsing or computed key construction can silently break persisted or in-memory index layouts.
- Null and undefined handling is behavior-sensitive, especially for sort fields.
- Polymorphic models and nested key paths are easy places for accidental regressions.
# Schema Faker Maintainer Overview
Maintainer guidance for type/name mapping logic and faker integration consistency.

## Ownership
- Schema-to-value generation pipeline.
- Name/type regex mapping tables for faker routines.
- Nested schema generation behavior.

## High-Signal Entry Points
- src/
- mapping logic for names/types
- faker integration boundary code

## Integration Boundaries
- Depends on @travetto/schema metadata registry.
- Consumed by test/fixture generation workflows.

## Compatibility Boundaries
- Generated shape/type semantics are externally visible.
- Mapping changes can alter downstream test behavior.

## Testing Expectations
- Validate primitive and nested schema generation.
- Validate known name-regex mappings produce expected value categories.
- Validate deterministic behavior controls (where supported).

## Change-Triage Guidance
- Mapping changes: evaluate fixture drift impact.
- Faker upgrades: verify API compatibility and output expectations.
- Schema integration changes: recheck nested generation correctness.

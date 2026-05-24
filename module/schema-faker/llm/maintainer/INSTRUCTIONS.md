# Schema Faker Maintainer Instructions

## Change Strategy
- Preserve broad mapping compatibility for common field names.
- Keep generation behavior predictable and documented.
- Prefer additive mappings over replacing established ones.

## Implementation Notes
- Keep regex mapping precedence explicit.
- Isolate faker-version-specific logic.
- Avoid hidden behavior changes for primitive defaults.

## Validation
- Run schema-faker module tests across representative schemas.
- Recheck name-based mapping behavior after changes.
- Validate nested object generation depth/shape correctness.

## Regression Checklist
- Type mappings remain stable.
- Name mappings remain sensible.
- Nested generation remains correct.

# Model Postgres Maintainer Instructions

## Change Strategy
- Keep PostgreSQL-specific behavior confined to dialect/connection classes.
- Preserve compatibility with model-sql contracts and service expectations.
- Prefer additive tuning over broad SQL contract rewrites.

## Implementation Notes
- Update error-code translation carefully and test duplicate/exists paths.
- Keep dialect operator mappings aligned with model-query expected semantics.
- Validate initialization flows that rely on extension setup and pooled connections.

## Validation
- Run module tests and composed model-sql integration tests on PostgreSQL.
- Re-test transaction boundaries, schema introspection, and index lifecycle behaviors.

Regression checklist:
- Transaction modes maintain expected nested and isolated behavior.
- Error-code translation maps to stable framework errors.
- Introspection output still reconciles table/index metadata correctly.
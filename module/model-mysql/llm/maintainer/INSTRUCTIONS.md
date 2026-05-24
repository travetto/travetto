# Model MySQL Maintainer Instructions

## Change Strategy
- Keep MySQL-specific behavior isolated to dialect and connection classes.
- Preserve compatibility with model-sql contract expectations.
- Prefer additive updates over broad behavior shifts.

## Implementation Notes
- Re-validate duplicate/exists error mappings whenever driver behavior changes.
- Keep version-sensitive operator and string-length logic explicit and tested.
- Maintain stable query execution and prepared-statement lifecycle behavior.

## Validation
- Run module tests and model-sql integration tests with MySQL.
- Re-test transaction behavior, schema introspection, and indexed/query paths.
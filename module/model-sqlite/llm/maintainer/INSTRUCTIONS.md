# Model Sqlite Maintainer Instructions

## Change Strategy
- Keep SQLite-specific behavior isolated to dialect and connection classes.
- Preserve compatibility with model-sql service and contract expectations.
- Prefer additive changes over large SQL behavior rewrites.

## Implementation Notes
- Re-test lock recovery behavior whenever execute/retry logic is changed.
- Keep date/timestamp and regex mappings explicit.
- Validate PRAGMA and initialization behavior for startup and performance defaults.

## Validation
- Run module tests plus model-sql integration tests on SQLite.
- Re-check transaction, query, indexed, and schema lifecycle flows after edits.

Regression checklist:
- Busy/locked retry handling remains deterministic and bounded.
- Transaction behavior remains stable under nested and failure scenarios.
- Introspection output still maps correctly to schema lifecycle operations.
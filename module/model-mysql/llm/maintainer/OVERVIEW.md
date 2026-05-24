# Model MySQL Maintainer Overview
Maintainer guidance for MySQL dialect and connection behavior in the model-sql ecosystem.

## Ownership
- MySQL-specific SQL dialect adaptation and operator/type mappings.
- MySQL connection/pool lifecycle and error-code translation.
- Metadata introspection used for schema reconciliation.

## High-Signal Entry Points
- src/dialect.ts
- src/connection.ts
- README.md
- support/

## Integration Boundaries
- Extends @travetto/model-sql abstractions (`SQLDialect`, `Connection`).
- Consumed through composed `SQLModelService` from model-sql.
- Relies on mysql2 driver behavior and version-specific SQL characteristics.

## Invariants
- Error-code mapping must continue to raise consistent framework-level errors.
- Version-aware operator/type behavior must remain deterministic.
- Connection lifecycle and prepared-statement execution must avoid leaks.
- Table/index introspection output must remain accurate for lifecycle reconciliation.

## Extension Points
- Dialect SQL behavior can be extended additively for compatible features.
- Connection options can be tuned through model.sql config.
- Provider composition remains via model-sql service setup.

## Testing Expectations
- Run module tests and integrated model-sql suites against MySQL.
- Validate duplicate-key handling, transaction behavior, and query translation.
- Re-check schema update and truncate flows after dialect changes.

## Risk Areas
- Version-dependent SQL behavior can introduce hidden regressions.
- Connection/pool changes can affect reliability and throughput.
- Introspection query drift can cause schema management mismatches.
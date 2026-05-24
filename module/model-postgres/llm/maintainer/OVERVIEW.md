# Model Postgres Maintainer Overview
Maintainer guidance for PostgreSQL dialect and connection implementation in the model-sql ecosystem.

## Ownership
- PostgreSQL-specific dialect behaviors and SQL customization.
- Connection/pool lifecycle and PostgreSQL error translation.
- Table/introspection metadata logic used by schema lifecycle operations.

## High-Signal Entry Points
- src/dialect.ts
- src/connection.ts
- README.md
- support/

## Integration Boundaries
- Extends @travetto/model-sql abstractions (`SQLDialect`, `Connection`).
- Used by composed `SQLModelService` from model-sql.
- Depends on PostgreSQL driver behavior and extension availability.

## Invariants
- PostgreSQL error-code mapping must continue producing consistent framework errors.
- SQL operator/type mappings must remain compatible with model-query semantics.
- Transaction and connection lifecycle behavior must preserve model-sql expectations.
- Table/column/index introspection must remain accurate for schema reconciliation.

## Extension Points
- Dialect-level SQL behavior can be extended additively.
- Connection options can be tuned through model.sql configuration.
- Provider composition remains through model-sql service injection.

## Testing Expectations
- Run module tests and at least one integrated model-sql suite using PostgreSQL.
- Validate transaction behavior, index updates, and query translation.
- Re-check schema introspection and create/update/drop lifecycle flows.

## Risk Areas
- SQL/operator mapping mismatches can surface as subtle query regressions.
- Connection pooling or transaction behavior changes can affect all write paths.
- Introspection query changes can cause schema drift during upsertModel.
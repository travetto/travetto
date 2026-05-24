# Model SQL Maintainer Overview
Maintainer guidance for SQL model abstraction layers, transaction decorators, and dialect-driven behavior.

## Ownership
- Shared SQL service implementation for model contracts.
- Connection context and transaction wrapper behavior.
- Schema traversal/translation utilities and SQL dialect integration points.

## High-Signal Entry Points
- src/service.ts
- src/connection/base.ts
- src/connection/decorator.ts
- src/dialect/base.ts
- src/util.ts
- src/table-manager.ts
- support/test/

## Integration Boundaries
- Depends on @travetto/model, @travetto/model-query, and @travetto/model-indexed contracts.
- Serves as the core for SQL provider modules (mysql, postgres, sqlite).
- Relies on @travetto/context for active connection and transaction scope.

## Invariants
- Connection activation and transaction nesting semantics must remain deterministic.
- Dialect APIs must stay stable enough for downstream provider implementations.
- Schema traversal and field mapping must preserve model shape and dependent-table consistency.
- Query and indexed paths must keep parity with their shared contract expectations.

## Extension Points
- Implement new SQL providers by supplying a dialect and connection implementation.
- Extend SQL generation additively in dialect classes rather than bypassing the service contracts.
- Add utility behavior only when it remains provider-agnostic at the model-sql layer.

## Testing Expectations
- Run model-sql support tests and at least one concrete SQL provider integration suite.
- Validate transaction behavior (nested/isolated), bulk flows, indexed lookups, and query translation.
- Verify schema upsert/drop/truncate flows after traversal or table-manager changes.

## Risk Areas
- Transaction wrapper changes can affect every write path across SQL providers.
- SQL generation drift between dialect and service assumptions can cause runtime query failures.
- Refactors in `SQLModelUtil` can silently break nested-model mapping and result hydration.
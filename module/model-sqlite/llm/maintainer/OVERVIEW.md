# Model Sqlite Maintainer Overview
Maintainer guidance for SQLite dialect and connection behavior in the model-sql ecosystem.

## Ownership
- SQLite-specific SQL dialect mappings and overrides.
- SQLite connection lifecycle and retry/locking behavior.
- Table/index/foreign-key introspection support for schema reconciliation.

## High-Signal Entry Points
- src/dialect.ts
- src/connection.ts
- README.md

## Integration Boundaries
- Extends @travetto/model-sql abstractions (`SQLDialect`, `Connection`).
- Consumed by composed `SQLModelService` from model-sql.
- Depends on node:sqlite behavior and file-backed runtime semantics.

## Invariants
- Lock/retry handling must remain safe and deterministic for recoverable busy/locked states.
- Dialect SQL overrides must keep query/update/delete semantics aligned with model-sql expectations.
- Introspection results must remain accurate for schema lifecycle operations.
- Connection/pool lifecycle must avoid resource leaks.

## Extension Points
- Dialect behavior can evolve additively for SQLite capabilities.
- Connection options may be tuned via `model.sql` config options.
- Composition remains through model-sql service wiring.

## Testing Expectations
- Run module tests and model-sql integration tests with SQLite.
- Validate locking retries, transaction behavior, and metadata introspection.
- Re-check indexed/query compatibility after SQL override changes.

## Risk Areas
- SQLite lock behavior can cause intermittent failures if retry logic regresses.
- SQL override tweaks can introduce subtle behavioral drift from other SQL providers.
- File-path and runtime initialization changes can break local/dev startup paths.
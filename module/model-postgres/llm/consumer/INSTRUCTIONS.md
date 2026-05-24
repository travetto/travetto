# Model Postgres Instructions
How to use PostgreSQL with Travetto model-sql contracts.

## Setup
1. Install @travetto/model-postgres and @travetto/model-sql.
2. Configure `model.sql` connection settings.
3. Wire `SQLModelService` with `PostgreSQLDialect` in DI.

## Usage Workflow
- Use `SQLModelService` as the application-facing provider surface.
- Keep transaction-sensitive service methods wrapped by model-sql transactional behavior.
- Use query contracts for filtering and indexed contracts for deterministic lookup paths.
- Let storage/model lifecycle routines manage schema state in development workflows.

Minimal pattern:
1. Keep SQL service composition and DB config in one DI factory boundary.
2. Keep transactional business flows in service classes, not request handlers.
3. Validate one representative CRUD/query/indexed flow in CI against PostgreSQL.

## Safe Defaults
- Keep connection credentials and DB settings environment-scoped.
- Bound API-level query/paging limits.
- Validate schema assumptions before integrating with legacy relational layouts.
- Keep provider-specific tuning in dialect/connection configuration, not domain-layer code.
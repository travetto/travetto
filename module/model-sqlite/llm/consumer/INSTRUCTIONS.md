# Model Sqlite Instructions
How to use SQLite with Travetto model-sql contracts.

## Setup
1. Install @travetto/model-sqlite and @travetto/model-sql.
2. Configure `model.sql` values and SQLite file options.
3. Wire `SQLModelService` with `SqliteDialect` in DI.

## Usage Workflow
- Use the composed `SQLModelService` for application-facing CRUD/query/indexed operations.
- Keep transaction-sensitive workflows explicit.
- Use query contracts for flexible filtering and indexed contracts for deterministic key lookups.
- Let model-sql lifecycle flows manage schema creation/update in development.

## Safe Defaults
- Keep SQLite file paths explicit per environment.
- Bound API query/paging limits.
- Treat SQLite behavior as backend-specific when comparing against other SQL providers.
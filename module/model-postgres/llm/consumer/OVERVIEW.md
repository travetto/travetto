# Model Postgres Overview
The @travetto/model-postgres module provides PostgreSQL-specific SQL dialect and connection support for the shared model-sql foundation.

## What This Module Is
This module exports `PostgreSQLDialect` and `PostgreSQLConnection`, which are used with `SQLModelService` from @travetto/model-sql to run Travetto model contracts on PostgreSQL.

## Why To Use It
- It gives a PostgreSQL runtime implementation for the model-sql abstraction.
- It supports SQL-backed model/query/indexed workflows while keeping application code provider-agnostic.
- It encapsulates PostgreSQL-specific SQL operators, types, and connection behavior.

## When To Use It
- Use it when PostgreSQL is your selected SQL backend.
- Use it when you want model-sql contract behavior with PostgreSQL execution.
- Use it when transactional SQL workflows are needed through the shared model API surface.

## When Not To Use It
- Do not use it directly without model-sql service composition.
- Do not assume generated schema aligns with arbitrary pre-existing relational schemas.
- Do not use it if a non-SQL provider better matches your data and workload profile.

## Core Capabilities
- PostgreSQL dialect implementation with operator/type tuning.
- PostgreSQL connection and query execution support with transaction-aware behavior.
- Schema/table introspection support used by model-sql lifecycle operations.
- Compatibility with model-sql CRUD/query/indexed/bulk features through composed service wiring.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes.

## Core APIs and Extension Points
- `PostgreSQLDialect`: SQL generation and PostgreSQL-specific behavior.
- `PostgreSQLConnection`: connection pooling and query execution behavior.
- Composition point: `SQLModelService(context, config, new PostgreSQLDialect(context, config))`.

Decision guideline:
Use model-postgres when PostgreSQL is your SQL target and you want shared model-sql behavior with provider-specific SQL encapsulated in one module.

## Typical Integration Flow
1. Configure `model.sql` settings.
2. Compose `SQLModelService` with `PostgreSQLDialect`.
3. Resolve the composed service via DI as the active model provider.
4. Use shared model/query/indexed contracts from application code.

## Practical Scenario
An application running on PostgreSQL needs queryable document-like model behavior without writing provider-specific business code. The service composes `SQLModelService` with `PostgreSQLDialect`, then keeps all domain logic on shared model/query interfaces while PostgreSQL-specific SQL generation stays isolated in the module.

Common pitfalls:
- Assuming dialect-level defaults cover all extension/privilege requirements in every environment.
- Embedding PostgreSQL-specific SQL assumptions in application services instead of provider boundaries.
- Skipping transaction-path validation after connection or error-mapping changes.
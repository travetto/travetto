# Model Sqlite Overview
The @travetto/model-sqlite module provides SQLite-specific SQL dialect and connection support for the shared model-sql foundation.

## What This Module Is
This module exports `SqliteDialect` and `SqliteConnection`, which are composed with `SQLModelService` from @travetto/model-sql to run Travetto model contracts on SQLite.

## Why To Use It
- It enables lightweight SQL-backed model workflows without running a separate database service.
- It keeps application logic on provider-agnostic model/query contracts.
- It encapsulates SQLite-specific type/operator and connection behavior.

## When To Use It
- Use it for local development, tests, and lightweight deployments where SQLite fits.
- Use it when you want model-sql features with file-backed SQL storage.
- Use it when query and indexed contract behavior is needed through SQL abstraction.

## When Not To Use It
- Do not use it directly as your application service without model-sql composition.
- Do not assume generated schema maps cleanly to arbitrary legacy relational schemas.
- Do not choose it for workloads requiring concurrent high-throughput multi-writer behavior.

## Core Capabilities
- `SqliteDialect` for SQLite-specific SQL generation and behavior.
- `SqliteConnection` for node:sqlite-backed execution with pooled access control.
- Compatibility with model-sql CRUD/query/indexed/bulk contracts through composed wiring.
- SQLite metadata introspection for schema lifecycle operations.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes.

## Core APIs and Extension Points
- `SqliteDialect`: operator/type behavior, SQL overrides, and metadata description.
- `SqliteConnection`: connection creation, query execution, and retry behavior.
- Composition point: `SQLModelService(context, config, new SqliteDialect(context, config))`.

## Typical Integration Flow
1. Configure `model.sql` settings, including SQLite file options.
2. Compose `SQLModelService` with `SqliteDialect` in DI.
3. Resolve the composed service as the active model provider.
4. Use shared model/query/indexed contracts from business logic.

## Practical Scenario
A local dev environment needs full model/query behavior without external dependencies. The project wires `SQLModelService` with `SqliteDialect`, stores data in a local file-backed SQLite database, and keeps the same contract-driven application code used in larger environments.
# Model SQL Overview
The @travetto/model-sql module provides the SQL-backed model service foundation used by SQL provider modules.

## What This Module Is
This module defines SQL model configuration, connection and transaction decorators, SQL dialect contracts, and a concrete `SQLModelService` that implements model, query, indexed, and bulk capabilities.

## Why To Use It
- It gives a consistent SQL abstraction for Travetto model contracts.
- It centralizes SQL schema lifecycle behavior for model classes.
- It supports query and indexed operations without coupling to one SQL vendor.

## When To Use It
- Use it when your project uses SQL-backed provider modules such as model-postgres, model-mysql, or model-sqlite.
- Use it when you need transactional operations and SQL schema management integrated with model metadata.
- Use it when you want one provider contract for CRUD, query, bulk, and indexed workflows.

## When Not To Use It
- Do not use it to retrofit arbitrary legacy relational schemas with incompatible key assumptions.
- Do not use it when your datastore is document-oriented or key-value oriented.
- Do not assume all relational patterns map directly to this service model (for example composite primary-key ownership patterns).

## Core Capabilities
- `SQLModelService` for CRUD, query, suggest, facet, bulk, and indexed operations.
- SQL storage/model lifecycle via `upsertModel`, `deleteModel`, and `truncateModel`.
- Connection and transaction context management.
- SQL dialect abstraction for provider-specific SQL generation and execution.

## Decorators
- `@Connected`: ensure a method executes with an active SQL connection.
- `@ConnectedIterator`: ensure async iterator methods execute with an active SQL connection.
- `@Transactional(mode?)`: execute a method inside a managed transaction scope.

## Utility Classes (Non-Internal)
- `SQLModelUtil`: schema visitation, select/order translation, insert preparation, and result-cleaning helpers.

## Core APIs and Extension Points
- `SQLModelConfig` provides SQL provider configuration defaults.
- `Connection<C>` defines acquire/release, execution, and transaction lifecycle hooks.
- `SQLDialect` is the provider extension surface for SQL generation and datastore-specific behavior.
- `SQLModelService` is the shared service layer used by concrete SQL providers.

## Typical Integration Flow
1. Configure SQL settings via `model.sql` config.
2. Use a concrete SQL provider module that supplies a dialect and connection implementation.
3. Allow storage/model lifecycle initialization to materialize schema state.
4. Perform model CRUD/query/indexed operations through the active SQL model service.

## Practical Scenario
A service migrates from in-memory data to PostgreSQL while keeping model contracts unchanged. The application swaps in a SQL provider built on model-sql, keeps the same query/indexed service calls, and gains transaction support and SQL-backed durability with minimal application-layer changes.
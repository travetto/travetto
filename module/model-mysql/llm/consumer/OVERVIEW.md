# Model MySQL Overview
The @travetto/model-mysql module provides MySQL-specific SQL dialect and connection support for the shared model-sql foundation.

## What This Module Is
This module exports `MySQLDialect` and `MySQLConnection`, which are composed with `SQLModelService` from @travetto/model-sql to execute Travetto model contracts on MySQL.

## Why To Use It
- It enables MySQL as a runtime backend for model-sql contracts.
- It encapsulates MySQL-specific SQL/operator/type behavior and connection handling.
- It keeps application logic on provider-agnostic model/query interfaces.

## When To Use It
- Use it when MySQL is your selected SQL datastore.
- Use it when you need query/indexed model behaviors through model-sql.
- Use it when transactional SQL operations are required in the service layer.

## When Not To Use It
- Do not use it directly as an application-facing service without model-sql composition.
- Do not assume generated schema maps to arbitrary existing relational schema conventions.
- Do not use it when a non-SQL provider is better aligned with workload needs.

## Core Capabilities
- MySQL dialect implementation with version-aware operator and type behavior.
- MySQL pooled connection execution and framework error translation.
- Table description/introspection support for schema lifecycle management.
- Compatibility with model-sql CRUD/query/indexed/bulk flows through composed service wiring.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes.

## Core APIs and Extension Points
- `MySQLDialect`: SQL generation and MySQL-specific behavior.
- `MySQLConnection`: pooled connection and query execution behavior.
- Composition point: `SQLModelService(context, config, new MySQLDialect(context, config))`.

Decision guideline:
Use model-mysql when MySQL is the selected backend and you want to keep application logic on shared model-sql contracts while isolating MySQL behavior in provider composition.

## Typical Integration Flow
1. Configure `model.sql` for host/database/user/password and options.
2. Compose `SQLModelService` with `MySQLDialect` via DI.
3. Resolve the composed service as the active model provider.
4. Use shared model/query/indexed contracts from business logic.

## Practical Scenario
An internal application standardizes on MySQL but wants the same model/query abstraction used by other providers. It wires `SQLModelService` with `MySQLDialect`, keeps service code contract-driven, and relies on MySQL-specific execution details only inside the module.

Common pitfalls:
- Ignoring version-specific SQL/operator differences when planning upgrades.
- Coupling domain services to MySQL-specific assumptions instead of contract behavior.
- Skipping duplicate-key and rollback path verification after driver/dialect updates.
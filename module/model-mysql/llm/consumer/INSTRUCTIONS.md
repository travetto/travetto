# Model MySQL Instructions
How to use MySQL with Travetto model-sql contracts.

## Setup
1. Install @travetto/model-mysql and @travetto/model-sql.
2. Configure `model.sql` settings for your MySQL environment.
3. Wire `SQLModelService` with `MySQLDialect` in DI.

## Usage Workflow
- Use the composed `SQLModelService` as your application-facing model provider.
- Keep transactional write workflows explicit.
- Use query contracts for broad filters and indexed contracts for deterministic keys.
- Let model-sql lifecycle behavior manage schema updates in development workflows.

## Safe Defaults
- Use environment-specific credentials and connection options.
- Keep API paging limits bounded.
- Validate MySQL version behavior when relying on regex/operator semantics.
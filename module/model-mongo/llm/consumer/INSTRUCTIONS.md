# Model Mongo Instructions
How to use the Mongo-backed model provider reliably.

## Setup
1. Install and configure @travetto/model-mongo.
2. Set `model.mongo` fields directly or provide `connectionString`.
3. Ensure runtime environments provide required TLS certificate paths when SSL is enabled.

## Usage Workflow
- Resolve `MongoModelService` through DI and use it through model/query/indexed capability interfaces.
- Use query contracts for broad filtering and indexed contracts for deterministic key lookups.
- Use blob APIs for large binary payloads instead of embedding binary content in model documents.
- Tune `cullRate` and expiry behavior according to retention requirements.

Minimal pattern:
1. Centralize provider wiring and config resolution in one startup boundary.
2. Keep CRUD/query/indexed usage in repository-style adapters.
3. Validate one integration suite against local/dev config and one against production-like config.

## Safe Defaults
- Keep server-selection timeout conservative for local development and explicit for production.
- Validate index expectations on startup when model definitions change.
- Keep tenant namespace and credential values explicit per environment.
- Keep external user-driven query inputs constrained before provider execution.
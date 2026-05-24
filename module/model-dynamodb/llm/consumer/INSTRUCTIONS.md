# Model Dynamodb Instructions
How to use the DynamoDB-backed model provider effectively.

## Setup
1. Install @travetto/model-dynamodb.
2. Configure `model.dynamodb` client settings and namespace.
3. Resolve `DynamoDBModelService` through DI.

## Usage Workflow
- Use CRUD methods for base persistence operations.
- Define model-indexed descriptors for deterministic secondary access.
- Use indexed paging/list/suggest methods for sorted and filtered retrieval.
- Use provider lifecycle methods to keep table/index definitions aligned with model metadata.

Minimal pattern:
1. Keep DynamoDB config and provider wiring centralized.
2. Treat indexed descriptor changes as migration events with rollout planning.
3. Validate CRUD plus indexed retrieval flows against both local and cloud-like configs.

## Safe Defaults
- Keep namespace explicit for environment isolation.
- Treat new/changed indexes as migration-sensitive and validate data rollout implications.
- Bound list/paging operations in API-facing workflows.
- Keep table and GSI lifecycle operations explicit in deployment runbooks.
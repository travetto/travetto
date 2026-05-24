# Model Dynamodb Overview
The @travetto/model-dynamodb module provides a DynamoDB-backed implementation of model and indexed contracts.

## What This Module Is
This module exports `DynamoDBModelService`, `DynamoDBModelConfig`, and `DynamoDBUtil` for CRUD, expiry, storage lifecycle, and model-indexed operations on DynamoDB.

## Why To Use It
- It supports managed key-value/document persistence with DynamoDB.
- It supports deterministic model-indexed access patterns via global secondary indexes.
- It keeps application code aligned with shared model/indexed contracts.

## When To Use It
- Use it when DynamoDB is your selected persistence backend.
- Use it when CRUD plus indexed lookup/list/suggest behavior is needed.
- Use it when namespace-scoped table naming and managed table lifecycle are useful.

## When Not To Use It
- Do not use it when full model-query contract support is required.
- Do not expect retroactive index backfill for newly introduced index definitions.
- Do not assume relational uniqueness semantics beyond provider behavior.

## Core Capabilities
- `DynamoDBModelService` supports CRUD, expiry-aware behavior, storage lifecycle, and indexed contract methods.
- Provider-managed table and GSI lifecycle for model definitions.
- Namespace-aware table naming via config.
- Paging/listing/suggest flows over DynamoDB query patterns.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
- `DynamoDBUtil`: index-name derivation, index-change detection, attribute conversion, and expiry-aware load helpers.

## Core APIs and Extension Points
- `DynamoDBModelConfig` is bound at `model.dynamodb` and controls client endpoint/config and namespace.
- `DynamoDBModelService` is the runtime provider surface for CRUD/indexed/storage contracts.
- `DynamoDBUtil` provides reusable transformation and index-computation helpers.

## Typical Integration Flow
1. Configure `model.dynamodb` endpoint/client options and namespace.
2. Resolve `DynamoDBModelService` via DI as active provider.
3. Use CRUD and indexed contracts in application code.
4. Use provider storage/model lifecycle methods to manage table/index setup.

## Practical Scenario
An application uses DynamoDB with computed secondary indexes for tenant-specific lookups and sorted timelines. The provider computes and updates GSI-related attributes during writes, and application services use indexed contract methods for predictable read patterns without direct DynamoDB query construction.
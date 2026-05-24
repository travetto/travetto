# Model Firestore Overview
The @travetto/model-firestore module provides a Firestore-backed implementation of Travetto model contracts.

## What This Module Is
This module exports `FirestoreModelService` and `FirestoreModelConfig` for CRUD, storage, and indexed operations over Google Firestore.

## Why To Use It
- It gives a managed document datastore backend aligned with Travetto model contracts.
- It supports deterministic indexed lookup/listing flows through model-indexed integration.
- It supports emulator-friendly local development configuration.

## When To Use It
- Use it when Firestore is your selected backend.
- Use it when you need CRUD plus computed indexed access patterns.
- Use it when emulator support is part of local development workflow.

## When Not To Use It
- Do not use it when full model-query contract support is required.
- Do not assume unique-index semantics beyond what Firestore and provider logic enforce.
- Do not rely on provider-specific behavior to replace domain-level validation.

## Core Capabilities
- `FirestoreModelService` supports CRUD, storage lifecycle, and model-indexed operations.
- `FirestoreModelConfig` supports emulator, credentials, project/namespace, and runtime config finalization.
- Indexed lookup, pagination, and suggestion behavior via computed index metadata.
- Namespace-aware collection naming.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exports no standalone utility classes; primary API is `FirestoreModelService` and `FirestoreModelConfig`.

## Core APIs and Extension Points
- `FirestoreModelConfig` is bound at `model.firestore` and drives client initialization.
- `FirestoreModelService` is the runtime provider surface for CRUD and indexed contracts.
- Service wiring can be customized through DI factory registration.

Decision guideline:
Use model-firestore when Firestore is your operational target and deterministic indexed access patterns (without full model-query support) meet your endpoint needs.

## Typical Integration Flow
1. Configure `model.firestore` credentials/emulator/project settings.
2. Resolve `FirestoreModelService` as the active model provider.
3. Use CRUD and indexed contracts from application code.
4. Use namespacing to isolate environments or tenants as needed.

## Practical Scenario
An application uses Firestore in production and emulator in local development. It configures `model.firestore`, keeps model CRUD and indexed access on shared contracts, and uses the same domain service code in both environments while only the provider configuration changes.

Common pitfalls:
- Assuming index definitions and query constraints can be changed freely without runtime index requirements.
- Letting emulator and production credential flows diverge without validation.
- Using indexed endpoints without explicit paging and suggestion constraints.
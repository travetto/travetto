# Model Firestore Instructions
How to use the Firestore-backed model provider effectively.

## Setup
1. Install @travetto/model-firestore.
2. Configure `model.firestore` with credentials or emulator settings.
3. Resolve `FirestoreModelService` through DI.

## Usage Workflow
- Use CRUD methods for core persistence operations.
- Define and use model-indexed descriptors for deterministic secondary access.
- Use namespace configuration to segment environments.
- Keep endpoint-level constraints explicit for indexed paging and suggestion behavior.

## Safe Defaults
- Use emulator defaults for local development where possible.
- Keep credential sourcing explicit and validated.
- Treat indexed behavior as contract-driven and validate index definitions at startup.
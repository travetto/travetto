# Auth Model Instructions
How to use model-backed authentication safely.

## Setup
1. Install @travetto/auth-model plus one model CRUD provider.
2. Define a model that contains registered-principal fields.
3. Compose `ModelAuthService` through DI with explicit mapping functions.

## Usage Workflow
- Keep model-to-principal and principal-to-model mapping logic explicit.
- Use service methods for register/authenticate/update-password/reset-token flows.
- Keep password operations centralized through module helpers.

Minimal pattern:
1. Validate identity payload.
2. Delegate to `ModelAuthService` for principal registration or authentication.
3. Persist model updates through mapped service behavior.

## Safe Defaults
- Keep password/hash/salt/reset fields confined to auth-model boundaries.
- Keep mapping functions stable as your user model evolves.
- Return typed auth failures instead of generic runtime errors.

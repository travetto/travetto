# Auth Instructions
Practical approach for integrating authentication and authorization.

## Setup
1. Implement an Authenticator for identity verification.
2. Implement an Authorizer for permission checks where needed.
3. Wire implementations through DI and consume via AuthService/AuthContext.

## Usage Workflow
- Normalize principal shape early in your authenticator.
- Keep authorization checks explicit and centralized.
- Use AuthContext for request-local auth state access.

Minimal pattern:
1. Authenticate credentials/token into a stable principal shape.
2. Run one or more authorizers to attach/validate permissions.
3. Store and consume request-local state through AuthContext.

## Safe Defaults
- Treat token parsing/verification and permission checks as separate concerns.
- Keep Principal payload minimal and stable.
- Return clear auth errors for denied/invalid states.
- Keep auth error typing predictable for endpoint and interceptor handling.

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

## Safe Defaults
- Treat token parsing/verification and permission checks as separate concerns.
- Keep Principal payload minimal and stable.
- Return clear auth errors for denied/invalid states.

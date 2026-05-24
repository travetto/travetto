# Auth Web Passport Instructions
How to integrate Passport strategies with auth-web.

## Setup
1. Install @travetto/auth-web-passport and required passport strategy packages.
2. Create strategy instance and wrap with `PassportAuthenticator`.
3. Register authenticator via DI symbol for auth-web `@Login` usage.

## Usage Workflow
- Keep provider profile mapping to principal explicit and stable.
- Use dedicated login and callback routes for multi-step strategy flows.
- Keep strategy configuration secrets and callback URLs environment-specific.

Minimal pattern:
1. Define strategy config and callback.
2. Wrap strategy with principal mapping.
3. Apply `@Login(providerSymbol)` to auth routes.

## Safe Defaults
- Keep principal payload minimal and provider-agnostic.
- Validate callback and failure-path behavior in integration tests.
- Keep strategy naming and DI symbols stable for route configuration.

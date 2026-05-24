# Auth Web Passport Overview
The @travetto/auth-web-passport module integrates Passport strategies into auth-web authenticator flows.

## What This Module Is
This module provides a passport-backed authenticator bridge so existing Passport strategies can be used with Travetto auth-web decorators and context handling.

## Why To Use It
- It enables reuse of mature Passport strategy ecosystem.
- It keeps strategy-specific identity mapping isolated from endpoint logic.
- It integrates with auth-web login flows using standard authenticator contracts.

## When To Use It
- Use when external identity providers are already implemented through Passport.
- Use when strategy middleware behavior should be wrapped as an authenticator.
- Use when callback-based identity flow needs to map into principal contracts.

## When Not To Use It
- Do not use if simple native authenticators already satisfy your needs.
- Do not treat Passport strategy output as principal without explicit mapping.

## Core Capabilities
- Passport strategy adaptation into `Authenticator` contract.
- Mapping between strategy user payload and framework principal.
- Compatibility with auth-web login endpoint decoration.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `PassportAuthenticator`: Passport strategy adapter implementing auth authenticator behavior.

## Core APIs and Extension Points
- `PassportAuthenticator` constructor accepts strategy id, strategy instance, and mapping function.
- DI registration via factory symbols to select strategy providers at runtime.

Decision guideline:
Use PassportAuthenticator when you need Passport ecosystem support, but keep principal mapping explicit and minimal.

## Typical Integration Flow
1. Configure Passport strategy instance.
2. Wrap strategy in `PassportAuthenticator` with principal mapping function.
3. Register authenticator via DI symbol.
4. Use symbol in auth-web `@Login` flows.

## Practical Scenario
For social login, wrap the provider strategy in `PassportAuthenticator`, map profile payload to principal fields, and complete login/callback routes using auth-web decorators.

Common pitfalls:
- Omitting explicit user-to-principal mapping and leaking provider-specific payload shape.
- Assuming Passport middleware behavior matches all transport adapters without testing.
- Ignoring callback route behavior and multi-step strategy flow requirements.

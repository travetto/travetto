# Auth Model Overview
The @travetto/auth-model module connects auth contracts to model-backed user storage and password lifecycle behavior.

## What This Module Is
This module bridges @travetto/auth contracts with @travetto/model CRUD services by providing a service-oriented mapping between persisted user models and registered principals.

## Why To Use It
- It centralizes password hash/salt/reset-token behavior.
- It lets auth identity storage run on any supported model CRUD provider.
- It separates auth model mapping from endpoint/business logic.

## When To Use It
- Use when local user registration/authentication state is persisted in a model provider.
- Use when you need consistent mapping between user records and `RegisteredPrincipal`.
- Use when password and reset-token lifecycle is part of your auth flow.

## When Not To Use It
- Do not use if identity is fully external and no local auth model persistence is required.
- Do not duplicate hash/salt behavior in unrelated services.

## Core Capabilities
- Model-backed authentication and principal registration workflows.
- Principal-model translation functions for inbound/outbound identity shapes.
- Password hash/salt and reset-token helper flows.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `AuthModelUtil`: password/hash/salt helpers for credential operations.

## Core APIs and Extension Points
- `ModelAuthService`: model-backed auth service orchestration.
- `RegisteredPrincipal`: principal shape including password/hash/reset metadata.
- Mapping functions supplied to `ModelAuthService` for model-to-principal and principal-to-model conversion.

Decision guideline:
Use explicit model/principal mapping functions as the canonical boundary between persistence and authentication contracts.

## Typical Integration Flow
1. Define a model implementing the required registered-principal fields.
2. Compose `ModelAuthService` with CRUD support and mapping functions.
3. Delegate register/authenticate/password-reset operations to the service.
4. Keep endpoint/service code focused on auth flow decisions, not hashing internals.

## Practical Scenario
For email/password login with reset support, map your `User` model to `RegisteredPrincipal`, use `ModelAuthService` for registration/authentication, and rely on consistent hash/salt generation for credential validation.

Common pitfalls:
- Storing plaintext passwords or bypassing hash/salt helpers.
- Changing mapping semantics without backward compatibility for existing records.
- Mixing external provider identity shape directly into persisted model structure.
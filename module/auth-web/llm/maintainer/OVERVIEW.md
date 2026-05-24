# Auth Web Maintainer Overview
Maintainer guidance for web-auth integration, codecs, and interceptor behavior.

## Ownership
- Auth-web endpoint decorator metadata and behavior.
- Request/auth context bridge and principal lifecycle.
- Principal codec transport and token handling defaults.

## High-Signal Entry Points
- src/decorator.ts
- src/interceptors/context.ts
- src/codec.ts
- src/config.ts
- src/types.ts

## Integration Boundaries
- Depends on @travetto/auth and @travetto/web contracts.
- Consumed by auth-web-session and auth-web-passport integrations.

## Compatibility Boundaries
- Decorator semantics and interceptor order are externally visible contracts.
- Principal codec behavior and token transport settings are semver-sensitive.

## Testing Expectations
- Validate decorator behavior on login/authenticated/unauthenticated/logout flows.
- Validate token decode/encode behavior for configured transport modes.
- Recheck multi-step authentication state behavior.

## Change-Triage Guidance
- Decorator changes: verify route behavior and access control compatibility.
- Codec changes: validate token compatibility and auth failure categories.
- Interceptor changes: verify context initialization and cleanup boundaries.

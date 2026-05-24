# Web Maintainer Overview
Maintainer guidance for @travetto/web endpoint, parameter, and interceptor internals.

## Ownership
- Controller/endpoint registration metadata.
- Request parameter extraction and coercion.
- Interceptor resolution and execution ordering.
- Response metadata and body/header utility semantics.

## High-Signal Entry Points
- src/decorator/controller.ts
- src/decorator/endpoint.ts
- src/decorator/param.ts
- src/decorator/common.ts
- src/util/common.ts
- src/util/endpoint.ts
- src/util/body.ts
- src/util/header.ts

## Integration Boundaries
- Serves as abstraction layer for transport adapters (express/fastify/koa/connect).
- Strong coupling with schema for parameter validation/coercion.

## Compatibility Boundaries
- Route metadata, parameter extraction, and interceptor ordering are externally visible contracts.
- Transport-neutral behavior in core web module is semver-sensitive for adapter modules.

## Testing Expectations
- Validate parameter extraction across path/query/header/body/context variants.
- Validate interceptor include/exclude behavior and ordering determinism.
- Recheck response metadata behavior (@Produces/@Accepts/@SetHeaders/@CacheControl).

## Change-Triage Guidance
- Decorator metadata changes: verify route registration and parameter binding compatibility.
- Extraction pipeline changes: test schema coercion and error-path consistency.
- Interceptor changes: validate exclusion, conditional registration, and ordering under mixed controllers.

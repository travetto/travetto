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

# Web Http Maintainer Overview
Maintainer guidance for Node HTTP server integration, request adaptation, and TLS/runtime behavior.

## Ownership
- `WebHttpServer` implementation and serve lifecycle.
- Request/response adaptation between Node and Web API contracts.
- TLS key handling and runtime config finalization behavior.

## High-Signal Entry Points
- src/node.ts
- src/types.ts
- src/util.ts
- src/config.ts

## Integration Boundaries
- Depends on @travetto/web dispatcher contracts.
- Consumed by application startup commands and server runtime tooling.

## Compatibility Boundaries
- Request/response adaptation semantics are externally visible.
- `WebHttpConfig` defaults and finalize behavior are semver-sensitive.

## Testing Expectations
- Validate http/https/http2 startup paths.
- Validate request adaptation and response emission for representative payloads.
- Recheck TLS key behavior for dev and production modes.

## Change-Triage Guidance
- Adapter changes: verify web request mapping compatibility.
- Config changes: test startup/finalize behavior across profiles.
- Serve lifecycle changes: validate startup/shutdown signal handling.

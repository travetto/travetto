# Web Http Overview
The @travetto/web-http module provides HTTP/HTTPS/HTTP2 server hosting for Travetto web applications.

## What This Module Is
This module is the concrete HTTP server integration layer that runs web dispatchers on Node server primitives with optional TLS support.

## Why To Use It
- It provides a default server runtime for web applications.
- It supports http/1.1, http/2, and TLS configuration.
- It integrates tightly with framework configuration and CLI startup flows.

## When To Use It
- Use when running a Travetto web app on Node HTTP server primitives.
- Use when you need TLS-enabled local or production server hosting.
- Use when custom startup/serve lifecycle behavior should still use framework server contracts.

## When Not To Use It
- Do not bypass server abstractions with custom raw HTTP wiring for standard app startup.
- Do not rely on development-generated TLS keys in production.

## Core Capabilities
- Node-backed HTTP server startup for web dispatching.
- Configurable HTTP version, bind address, and port behavior.
- TLS key handling with development self-signed fallback.
- Utility methods for request/response adaptation between Node and Web API types.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `WebHttpUtil`: helpers for handler creation, server startup, request adaptation, and response emission.
- `WebTlsUtil`: development key generation helpers for TLS scenarios.

## Core APIs and Extension Points
- `WebHttpServer` contract and default `NodeWebHttpServer` implementation.
- `WebHttpConfig` for runtime server and TLS settings.
- CLI integration through `web:http` and custom command entry points.

Decision guideline:
Use `WebHttpServer` and `WebHttpConfig` as the canonical startup/config surface, and keep transport-specific server behavior within module boundaries.

## Typical Integration Flow
1. Configure `web.http` values (version, port, bind, tls).
2. Start server via `trv web:http` or custom CLI command.
3. Let framework dispatcher handle request routing and response mapping.
4. Use utility hooks for custom server bootstrapping scenarios.

## Practical Scenario
For a production API with TLS and custom startup hooks, override config through DI/CLI entrypoint, initialize the server through `WebHttpServer`, and keep all request dispatching on standard Web API contracts.

Common pitfalls:
- Enabling TLS without valid production key material.
- Mixing raw Node request handling with framework dispatcher flow.
- Assuming HTTP/2 direct browser access works without TLS.

# Web Connect Overview
The @travetto/web-connect module provides bridge integration between Travetto web request contracts and Connect-style middleware.

## What This Module Is
This module adapts framework web request/response contexts for invocation of middleware written against Connect-like interfaces.

## Why To Use It
- It enables reuse of middleware ecosystems that expect Connect semantics.
- It supports interoperability scenarios (for example Passport strategy flows).
- It keeps adapter behavior centralized instead of duplicated across integrations.

## When To Use It
- Use when integrating middleware that expects Node/Connect request-response shapes.
- Use when auth or third-party middleware requires callback-based invocation style.
- Use when bridge behavior should remain isolated from endpoint business logic.

## When Not To Use It
- Do not use as a replacement for native web interceptor/controller patterns.
- Do not assume full EventEmitter/socket behavior beyond adapter guarantees.

## Core Capabilities
- Invocation adapter for connect-like middleware handlers.
- Request/response bridge utilities for middleware compatibility.
- Error/success propagation back into Web API flow.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `WebConnectUtil`: bridge invocation helpers for connect middleware execution.

## Core APIs and Extension Points
- `WebConnectUtil.invoke` and related adapter invocation surfaces.
- Integration hooks used by auth-web-passport and similar middleware bridges.

Decision guideline:
Use web-connect only at integration boundaries where connect middleware interoperability is required, and keep core endpoint logic on native web abstractions.

## Typical Integration Flow
1. Identify middleware requiring connect-style request/response contracts.
2. Invoke middleware via `WebConnectUtil` inside integration adapter.
3. Map middleware result back to framework auth/web contracts.
4. Keep middleware-specific behavior encapsulated in integration module.

## Practical Scenario
For Passport authentication strategy integration, invoke strategy middleware through web-connect adapter from auth integration code and return mapped principal data into framework auth context.

Common pitfalls:
- Expecting full Node socket/EventEmitter compatibility beyond documented bridge scope.
- Mutating bridged request/response shapes in unsupported ways.
- Using web-connect in regular endpoints where native interceptors are cleaner.

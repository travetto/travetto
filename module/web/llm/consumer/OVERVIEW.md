# Web Overview
The @travetto/web module provides declarative HTTP endpoint development with typed parameters, interceptors, and controller routing.

## What This Module Is
This module is the framework web API layer for defining controllers, endpoints, parameter binding, and interceptor-driven request processing.

## Why To Use It
- It gives explicit, typed API contracts with decorator-driven routing.
- It centralizes cross-cutting behavior through interceptors.
- It keeps request/response logic framework-consistent and testable.

## When To Use It
- Use when building HTTP APIs or service backends.
- Use when endpoints require typed validation and metadata.
- Use when middleware-like behavior should be reusable and ordered.

## When Not To Use It
- Do not manually parse path/query/body/header data in endpoint methods.
- Do not duplicate interceptor logic inside each endpoint handler.

## Core Capabilities
- Controller/endpoint decorators for route definition.
- Typed request parameter extraction from path, query, headers, and body.
- Interceptor pipeline for cross-cutting concerns.
- Response metadata controls (content type, headers, caching, accepted MIME types).

## Decorators
- @Controller: register a controller and route prefix.
- HTTP endpoint decorators: @Get, @Post, @Put, @Patch, @Delete, @Head, @Options.
- @Endpoint: generic endpoint declaration.
- Parameter decorators: @PathParam, @QueryParam, @HeaderParam, @Body, @Param, @ContextParam.
- Metadata/config decorators: @SetHeaders, @Produces, @CacheControl, @Accepts.
- Interceptor/control decorators: @ConfigureInterceptor, @ConditionalRegister, @ExcludeInterceptors.

## Utility Classes (Non-Internal)
- WebCommonUtil: MIME matching, ordering, status code and request param helpers.
- WebBodyUtil: body parsing/serialization and multipart helpers.
- EndpointUtil: endpoint parameter extraction and filter-chain helpers.
- WebHeaderUtil: cookie and header parsing helpers.
- CookieJar: cookie read/write and signing-aware operations.
- KeyGrip: HMAC key/signature generation and verification.
- NetUtil: port/address helper operations for web runtime contexts.

## Core APIs and Extension Points
- Controller and endpoint decorators.
- WebInterceptor contracts and registration controls.
- Request/response metadata decorators for protocol behavior.

## Typical Integration Flow
1. Define a controller with @Controller.
2. Add endpoint methods with HTTP decorators.
3. Bind path/query/header/body/context parameters.
4. Configure interceptors and response metadata.

## Practical Scenario
For a versioned REST API, define route groups by controller, enforce auth/logging via interceptors, and keep endpoint methods focused on typed domain operations.


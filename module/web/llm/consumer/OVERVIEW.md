# Web Overview
The @travetto/web module provides declarative HTTP endpoint development with typed parameters, interceptors, and controller routing.

## Primary Capabilities
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

## When to use it
Use this module when building HTTP APIs or web backends with explicit contracts and consistent middleware behavior.

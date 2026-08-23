# Travetto 6.0 Release Notes

> Release 6.0 - 2025-5-1

## Major/Breaking Changes

### Auth Overhaul
* Auth system has been rewritten with respect to the modules, and the relationship with the result module
* The auth session has migrated from being the owner various contracts to the arbiter of auth state
   * AuthService/AuthContext now represent the authentication information, regardless of rest patterns
#### Jwt is gone
   * This is now integrated into auth-rest by default using nJwt
#### Auth-rest-jwt is gone
   * This is now integrated into auth-rest by default
#### Rest-session is moved to auth-session
   * Session is now entirely an auth-dependent store, and can no longer act as an intermediary for an auth cache
#### Auth-rest-session has been rewritten
   * Simplified to being the bridge between auth-session and rest
   * Session is tied to the principal lifecycle

### Web Overhaul (formerly know as Rest)
* Internals have been rewritten, interceptors are no longer `connect`/`express`/`koa`  compatible.
* Renamed Param type "X" to be named "X"Param.
* Added support for Conditional Endpoints
* Replaced external common middleware:
   * `compress()` is now `CompressInterceptor`
   * `decompress()` is now `DecompressInterceptor`
   * `cookies()` is now `CookieInterceptor`
   * `etag()` is now `EtagInterceptor`
   * `trustProxy()` is now `TrustProxyInterceptor`
* Reworked how contextual inputs are managed (`WebRequest`, `Principal`, `Session`)
   * These can all be accessed by `@Inject`ing the appropriate context provider
   * Now support `@ContextParam()` on controllers as a sort of contextual dependency injection.
      * Represents data that is contextually provided

#### rest-express, rest-express-lambda is gone
* Replaced by `web-node` and `web-aws-lambda` respectively
#### rest-koa, rest-koa-lambda is gone
* Replaced by `web-node` and `web-aws-lambda` respectively
#### rest-fastify, rest-fastify-lambda is gone
* Replaced by `web-node` and `web-aws-lambda` respectively

### Context
* The context module had an unfortunate limitation that required a rewrite of the internals
* Nested contexts, especially with Promise.all scenarios, resulted in unexpected behaviors across the board.

### Command
* The command module has been fully archived, and its functionality integrated into the CLI
* Docker support has been removed, in general, and specific use cases for service startup are now handled directly by the CLI

### Compiler
* Added support for getting a reference to an `interface`.  
* Reworked the entry flow, and where we store the generated content for context and entrypoints.  
* Prepared for erasable types, with the idea that some of these files may be readable directly, minus node not supporting type erasure from node_modules

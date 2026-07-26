# Travetto 7.0 Release Notes

> Release 7.0 - 2025-12-1

## Major/Breaking Changes

## Dynamic Overhaul
The dynamic nature of the framework was removed for a restart on change model
  * Proxies - gone
  * Class change source - gone
  * Method change source - gone
  * Model change schema - gone
  * commonjs module hijacking - gone
  * web route re-registering - gone

This was a huge drop in complexity for the framework whilst improving the reliability of the  detect changes and respond logic.  This also represents a huge drop in mental load when making changes related to these areas, as there was a ton of subtle connectivity.

## ESM Migration
Given the work on removing dynamic behavior, ESM was inevitable.  This major revision bump moves the framework to the future, and leaves commonjs behind.

## Registry Unification
The registry module was overhauled to provide a common Registry implementation.
  * DI
  * Schema
  * Model
  * Web
  * CLI
  * Test

### Schema consolidation
* Web, Schema, DI have all been consolidated to have type information and transformation serviced by the Schema module.  This reduces the surface area in preparation for TS 7.
* All registries now defer type, and metadata information to the Schema registry providing a single source of truth.
* Mapped types are now handled as computed types vs the set of properties that remain.  This allows for better tracking of the source class, and reduced file sizes when using mapped types.
* Description, name, alias, etc, are now only available on the Schema data, and that is used by web/di appropriately.  
* Methods are now first class citizens within the Schema registry, and are used for Web/CLI validation/invocation.

### Web Http/Node Unification
The HTTP server and Node.js specific web implementations have been consolidated. `web-http-server` has been renamed to `web-http` and `web-node` specific logic was integrated directly into it.  `web-node` has been removed.

## ESLint Cleanup
The `lint:*` commands have been renamed to `eslint:*` to make it clear what is actually happening when calling register and linting.

# Travetto 3.0 Release Notes

> Release 3.0.0: 2022-09-01 -- Future facing

## Major/Breaking Changes

### The /extension/ pattern is removed
All "extension" points have been moved to their own modules, removing support for @file-if and @line-if directives.  These patterns were convenient, but led to more complexity around determining what was in use and what wasn't.  Now package.json is definitive, and it is clear what files/dependencies are needed or not.

### Transpilation/Loading Overhaul
One of the primary goals here is to end up with a `.trv_cache` folder that is directly invocable without compilation. The ideal here is the previous work around a "readonly" mode is replaced in a world where there is only javascript files.  This provides an increased level of security while setting the stage for integrating with existing js bundlers.  This will have ramifications in the pack extension.

### JSX Support

### Docs to JSX

### ESM Support

### Filesystem access 
- Manifest

### Logging Overhaul

### Config Overhaul

### Resources Overhaul

### VS Code extension overhaul

### New Modules (or old but new)
* Auth-model - Holds model for auth persistence with the model framework
* Auth-rest-jwt - Support for auth-rest and jwt tokens
* Auth-rest-session - Support for auth-rest and session integration
* Auth-rest-context - Support for exposing the auth user into the request context support
* Auth-passport - Clear support for passport, and handles pulling the correct dependencies
* Email-nodemailer - Clear support for nodemailer, and handles pulling the correct dependencies
* Rest-aws-lambda - Extracted all aws lambda code and dependencies, and can be pulled in as needed
* Rest-express-lambda - rest-express + rest-aws-lambda + necessary deps
* Rest-koa-lambda - rest-koa + rest-aws-lambda + necessary deps
* Rest-fastify-lambda - rest-fastify + rest-aws-lambda + necessary deps
* Schema-faker - Clear support for faker, and handles pulling the correct dependencies

### Rest Interceptors
Standardizing rest interceptor patterns for enabling/disabling and ability to provide route specific overrides.

### Rest + Context
The Rest framework now treats context as a given, and can be disabled as needed.

### Typescript 4.9+
The shift to 4.9+ brought some unexpected changes that required rewriting how decorators are managed within the framework.  This also bit the eslint team.  Additionally "refinement" on comparing literal objects is now an error which broke some testing patterns.  There had always been a fallback, so no change was needed, but is pointing to providing a clearer pattern of how to use.

### Pack Overhaul
* Now integrates with rollup for producing a tree-shaken singular output file

--------------------------------------------------
encore 0.0.x: 2016-08-03 - 

--------------------------------------------------
* Simplistic base
* Moved to bootstrap

--------------------------------------------------
0.0.x: 2017-08-30 - 25df25468ba18629ec332db3ce96436083306ec1 - Released 
--------------------------------------------------

* Compiler enhancements
  * Hot module reloading
* Added registration framework
  * Added Dependency Injection built on it
* Fleshed out Asset module
* Standardized module file layout
* Reworked Test framework, supported TAP
* Created the vscode test plugin
* Documentation phase 1
* Merged Lifecycle into base
    * Application lifecycle now dependent on which modules used
* Model Elasticsearch
* Configuration move to DI
* Established Exec module 
* Rewrote phase management to describe dependencies better

--------------------------------------------------
Released 0.0.x monorepo: 2018-07-08 - 18b8297833dbba487594d2c27720d80208694e98
--------------------------------------------------

* Moved to mono repo with lerna 
* Alpha launch

--------------------------------------------------
Released 0.1.x: 2018-07-13 - 94dac6de9ef017002d1e952f34ae5b99171bda21
--------------------------------------------------

* Established github settings
* Working with lerna/nodejs quirks
* Expanded HttpRequest lib
* Moved extensions into own folder
* Established e2e for non unit tests
* Allow for development to work with symlinked packages
  * publishing and development become much easier
* Swagger Integration 

--------------------------------------------------
Released 0.2.x:  2018-08-10 - 6fc18359974f88bfc6f0d6df21aaf746073bc636
--------------------------------------------------

* Reworking to abstract rest middleware out
   * Koa
   * Fastify
* Moving express to rest, and going generic
* Introduce passport support
* Establishing CLI support
* Separating out email templating from email
* Moving pool into exec
* Began work on AWS Lambda support for rest endpoints
 
--------------------------------------------------
Released 0.3.x: 2018-08-30 - fb6bd5439f7491a7b8446bd3717c3ba35d8dbd4a
--------------------------------------------------

* Reworked utils for development
* Redefined base to not rely on transpilation
* Dropped barrel imports
* Simplified library files
* Rewrote inky in html5 parse
* Yeoman generator
* JWT Library
* Custom YAML Library (performance
* Model query language
* Docs phase 2

--------------------------------------------------
Released 0.4.x: 2018-10-24 - 813fb4f842f149bcaa28c2e055e81fc86221eae1
--------------------------------------------------
  
* Docs enhanced
* General bug fixes
* PathUtil as a base
* Cyclical dependency detection
* Simplified 
* Allow for CLI to know about entry points, and to execute
* Simplified logging
* Enhanced elasticsearch schemas

--------------------------------------------------
Released  0.5.x: 2018-12-28 - a8c58104a586baa6203f38c9517fbb5a60ecec5c
--------------------------------------------------

* Full test cleans up after self
* Development DOCS updated
* Simple caching enhancements
  * Cache dir now computed differently
  * Tests use unique cache dir for test runner
* Streamlined dev vs watch usage
* Enhanced app entry point usage
   * Detect parameters
   * Reset app cache on change
   * Application decorator with transformer
* vscode Plugin migration
  * Support all the things
* Testing stability
* Schema modifications
  * All view changes
  * New view management
* Unified file path usage and resource loading

------------------------------------------------------
Release 0.6.x: 2019-04-15 -- BETA -- 7bf8998ed07dcf257981ffa73aa1b9630f8ff6b1
------------------------------------------------------
* Test assertions and output cleanup
  * Cleanup tests output on run
* Using latest typescript
* Reworked CLI, convert to typescript, supporting color, and standardizing architecture
* Added in tab completion support for cli
* Auth Rewrite
* Worker breakout/rewrite
* Rest module rewrite, interceptors overhauled
   * Allow for direct binding of query/path/form params to function parameters
* General test stability
* Support for unhandled rejections in the testing framework
* Base logging upgrade, and ability to filter logging by package, folder etc.
* Reworked config/compiler, handling unloading properly now
* Session support at the framework level
* Reworked yeoman generator to use mustache and add auth support
* Separated boot (typescript to javascript compile) from base, base is now used by simple modules

------------------------------------------------------
Release 0.7.x: 2019-07-15 -- BETA -- 
------------------------------------------------------
### Major Fixes
* Updated to Node v12 and Typescript 3.5.x as a minimum requirement
* SQL support in the Model Service (postgres and mysql for initial rollout)
* Moved to async stack traces, which resulted in a substantial performance improvement
* Added xUnit as test format output for better integration with build systems
* Proper GEO distance/within queries for Mongo and Elasticsearch
   * SQL support is pending
* Swagger/Client Generation Fixes for ALL endpoints as well as endpoints with path parameters
   * Switched over to openapi tools as swagger-codegen-cli was out of date
* Rewrote all code transformers to follow specific pattern/framework
   * Code visiting is now in a single pass
   * Focuses on methods/fields/classes as specific type of visitation
   * Makes it very clear what each transformer does and how to modify it

### Minor Fixes
* Changes to ModelService to support rest-session being able to persist properly
* Yeoman Generator has been updated, and the internal dependency management has been rewritten
* Library updates to maintain latest working versions
* Brought support for Map/Set to route serialization as JSON objects and arrays
* Resolved issues with fastify and path determination
* Properly support redirects in Net util
* Worker pools now support async operations fully
* Resolved CORS issue with headers/methods
* General bug fixes in 
   * Rest
   * Rest Session
   * Schema
   * Email
   * Yeoman Generator
   * Model
   * Swagger

------------------------------------------------------
Release 1.0.0: 2020-07-04 -- Launch
------------------------------------------------------
### Breaking Changes
* *Provider / *Store classes have been renamed to *Source .  This to make the  sub-module model consistently named (Cache, Identity, Model)
* The AssetStore methods have been renamed to match the cache model, since they are basically the same thing
* Image manipulation is a new package and is no longer tied to the asset service
* The Email service has been simplified to only support mustache.
* The Email template service has been overhauled.  It is now a template compiler and there are command line tools to compile (watch and compile), and to the UI for development has been overhauled”
* Exec and Schedule  module have been removed
* The docker portion of Exec has been moved to the Command module
* The program execution part of Exec has been integrated into the boot module
* The Worker module has been simplified, and is only one worker input source now, (though others can be added)
* The Test  module now boasts a watchable test server, that will listen for changes in test files and automatically re-run them.  This is what is used to power the new plugin implementation.
* All ENV variables have been renamed from X to TRV_X  except for DEBUG, TRACE, and NODE_ENV
* The app module no longer supports isolated sub-apps, everything is always connected.
* The compiler  now knows about interfaces
* The compiler now is also able to infer return types, and so they should no longer be needed for DI and type checking
* Schema now supports simple types/interfaces for field definitions (also useful for SchemaQuery)
* The auto flag has been removed from the schema package
* Extensions files are now part of the barrel export, and will complain if used without the appropriate import.  E.g. import {SchemaQuery} from '@travetto/schema';
* The app cache is now located within the app directory as .trv_cache . Since the command line test run pre-compiles the tests, they use the same cache as well.
* Code transformation has been externalized to it's own module.

### Major Fixes
* Updated to Node v12 and Typescript 3.9.x as a minimum requirement
* 

------------------------------------------------------
Release 1.1.0: 2020-09-20 -- Incremental Improvements
------------------------------------------------------
### Major changes
* @travetto/pack is a new module that supports packing applications. 
* The @travetto/email-template development UI has been externalized into the VSCode Plugin.  Additionally some other enhancements have been made to the templating process.
* @travetto/cache now supports DynamoDB as a valid storage model
* @travetto/rest-fastify properly supports running a lambda context using the aws-lambda-fastify module.  

### Minor changes
* Moved typescript to require 4.0.0 or higher.

### Breaking changes
* @travetto/app has disconnected itself from the rest module and is now a standalone service, when desiring to run the application via the app module.
* @travetto/email-template now uses .email.html as the template suffix.
* @travetto/email-template the email dev UI has been removed.

------------------------------------------------------
Release 2.0.0: 2021-02-01 -- Model Rewrite
------------------------------------------------------

### Major and Breaking Changes 

#### Schema Overhaul

Schema has taken a role as the gatekeeper of all inbound data into the application. Now `application`, `config` and `rest` utilize the schema 
transformations and validations for entry points.  This enables consistent use of schema type information, validators, in all of these modules. 
This also means the error messaging is consistent and behaves  the same way across all of these modules.  

#### Model Overhaul
* Asset now relies on Models with Streaming support
* Cache now relies on Models with Expiry support
* Auth-Model relies on Models alone
* S3, Firebase, Redis, Dynamo were all added as standard model providers
* All model implementations now have extension testing for the services that they are compatible with
* `asset-mongo`, and `asset-s3` are gone, and relies on a `model` provider that has streaming
* `cache/src/extension/{redis,dynamodb}` are gone and are also now model provided
* `model` is gone and has been replaced by `model-core` and `model-query`.
* `model-core` is a series of interfaces/contracts, and some minor utility functions. All ownership has been pushed to the various providers.
* Method names have been standardized as `verbNoun` e.g. `getStream` or `deleteExpired`

#### Auth Overhaul
* Greatly simplified number of interfaces/classes to understand
* Identity has been folded into principal, and is now the standard bearer for a known user
* Request object has been reduced in complexity, and AuthContext is gone.
* Session has been reworked to be the counterpart to the JWT for encoding a principal to the user

#### Rest Internals Overhaul
* Testing support greatly increased, and provides clearer behavior for testing as a server, and as a lambda.
* Streamlined internals, and separated lambda from general usage

#### Support for Dynamic Module references, specifically, third party
* No longer symlinking for local dev
* Allows for better testing of extensions
* Moved the source code indexing into boot to be used by the CLI
   * All support/* files are converted to .ts
   * Indexing only looks for typescript files
   * Will speedup tools that rely upon full file system scanning

#### Extension Overhaul (and testing thereof overhaul)
* Extensions are now tested in isolation allowing for various combinations of extensions to be tested
* Relies on use of Dynamic Modules to allow for creating a custom cache related to the modules being loaded

#### Logging overhaul (Base no longer duplicates functionality of log)
* All filtering and formatting now belong to the log module
* All log statements are encouraged to following the pattern of `message`, `{ payload }`
* Startup logs may still need some support if the goal is suppression

#### Module reorg
* `auth-passport` is gone, and is now an extension of `auth-rest`.
* `auth-model` is gone, and is now an extension of `auth`.
* `asset-*` for implementations, are now model modules
* `cache`'s built in extensions have been removed.  `model` with expiry support is all that is needed now.
* Extensions have been moved to the module which owns the complexity (e.,g. schema rest support dealt more with the internals of rest than schema, and has been moved).
#### Typescript Upgrade
* Shifted codebase away from use of `any` to `unknown` where applicable (over 750 instances migrated)
* Migrated all `private var` usages to `#var`, and aligning with class initialization changes.
* Moving to typescript 4.3
* Converted all available files to `.ts`, only build scripts remain in `.js`

#### Dependency Injection Enhancements
* Using more interfaces where possible (and less reliance on abstract classes)
   * This allows for better control at the cost of potentially duplicated functionality
* Support for injecting/registering by interfaces
* Better default behavior on multiple providers, with local code breaking ties.

#### Removed `sync` versions of `ResourceManager` methods
* All resource lookups are considered to be `async`, as runtime support for `sync` was an anti-pattern

#### Separated out configuration of which folders to scan during execution (and allowing for soft optional)
* This has the affect of removing a bunch of custom logic around tests
* Alt folders have been removed, and can be emulated by specifying `TRV_SRC_LOCAL` values as needed.

#### Compiler Ownership
* Reworked @travetto/boot compiler to create clear responsibility for managing the compiler/transpiler relationship with node runtime.
* Modified @travetto/compiler to no longer register extension directly, but extend functionality defined in boot 

#### Entrypoint Standardization
* Allow for use of `main` functions to allow for direct invocation of any file, primarily used for plugins and cli activities
* Removed all `plugin-*.js` files as in lieu of exposing a `main` function in the target files.
* Removed almost all `*.js` files in the test folders, in lieu of exposing `main` functions. Tests no longer auto execute on import.

#### Generator Simplification
* Moved away from using yeoman due to dependency bloat, and went with a simple `@travetto/cli` based solution. Can be invoked with `npx @travetto/scaffold`

#### Local Dev Overhaul
* Now relies on environment variables (`direnv` makes it easier) for augmenting what would have been embedded in the framework.
* Using tsconfig paths in lieu of symlinks, general development performance, and refactoring are substantially improved.
* Removed dependency on symlinks

### Non-Breaking Changes

#### Standard dependency upgrades

#### Lessened dependency on bash scripts, and moved build processes over to @arcsine/nodesh
* Local development should now support windows, but there may still be a few edge cases

#### Docs have been converted back to typescript, and the doc folders have been simplified
* Proper typechecking on all docs
* Renamed file from DOCS.js to doc.ts
* Moved main README.md to `related/overview/doc.ts`

### Lerna Removal
* Removed usage of lerna within framework, handling mono repo tasks manually
* Reduced hoisted node_module size by 40%

------------------------------------------------------
Release 2.2.0: 2022-07-25 -- Alignment
------------------------------------------------------
As the framework has been moving forward, there has been a drive and goal to align with the growing standards in the TS/JS community. The last version (2.1.0) and the current release, have been about removing technical debt, and aligning with the changing landscape. In this release, the fundamental shift has been towards: 

* Removing exceptions to Typescript strict mode, and relying on strict mode as the standard 
* Explicit typing of every method, which has had the side effect of changing some return types slightly. 
* Stricter linting rules to help enforce better practices (e.g. treating type casts as an anti-pattern) 
* Swapping out use of NodeJS.ReadableStream for stream.Readable. 
* Various dependency updates 
## Rest Body Parsing
Centralized rest body parsing to common, controlled code to help create a consistent experience.  Each framework is still responsible for compressing as the nuances of sending seem to be highly specific to each framework.

## Future Work
* ESM Support - Many dependencies are starting to move to ESM and this is starting to cause problems.  As soon as the loader proposal for ESM is finalized, this will be the next major release item.
* TC39 Decorators - The new decorator proposal hit Stage 3, and so this will point to a rewrite of all decorators within the framework, w/o any API changes.  This will have a dependency on Typescript moving in the right direction, but this looks to be a priority for TS4.9.  
* Heap Snap-shotting - A mechanism for bootstrapping startup overhead.  This would provide a boost to testing startup time, and allow for simplification of "unloading" code, that is primarily used for testing. 

------------------------------------------------------
Release 3.0.0: 2022-09-01 -- Future facing
------------------------------------------------------

## Major/Breaking Changes

### The /extension/ pattern is removed
All "extension" points have been moved to their own modules, removing support for @file-if and @line-if directives.  These patterns were convenient, but led to more complexity around determining what was in use and what wasn't.  Now package.json is definitive, and it is clear what files/dependencies are needed or not.

### Transpilation/Loading Overhaul
One of the primary goals here is to end up with a `.trv_cache` folder that is directly invokable without compilation. The ideal here is the previous work around a "readonly" mode is replaced in a world where there is only javascript files.  This provides an increased level of security while setting the stage for integrating with existing js bundlers.  This will have ramifications in the pack extension.

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

------------------------------------------------------
Release 3.1.0: 2023-03-01 -- Momentum
------------------------------------------------------

## Major/Breaking Changes

## Upgrade to Typescript 5.0
* Upgrade to Typescript 5.0

## CLI/App Overhaul
* @travetto/app is gone, and has been merged into @travetto/cli
* @travetto/cli has been completely rewritten and now is entirely based on @travetto/schema
* @travetto/schema Param decorators have been modified to deal with invalid type support
* @travetto/cli Exclude the README.\*, DOC.\* from  change detection for dependent changes.
* @travetto/{cli,repo} Moved repo specific commands to the repo module, version, list.
* @travetto/cli Fixed bug with support for negative numbers on the CLI
* @travetto/repo  Allow cli to be invoked from sub folders when package.json isn't directly available
* @travetto/watch Reworked watch behavior, and unified the streams of recursive and immediate into single method

## Terminal Upgrades for User Experience
* @travetto/terminal Streaming operations to a single line, now truncate content for said line
* @travetto/terminal Push terminal state queries to a sub process to mitigate weird state behavior

## Pack output is now isolated
* @travetto/manifest Removed need for package.json reading at runtime, all data is now integrated into the manifest.json
* @travetto/pack Reworked output to be fully self contained (node_modules in output is gone)
* @travetto/config Added support to ingest a JSON blob via env var

## Model Enhancements
* @travetto/model prePersist now runs pre-validation, this allows filling in required values via prePersist
* @travetto/model Standardized uuid generation and validation, and allow for fully custom uuid support
* @travetto/model Extended support for multiple specifiers for a single field

## DI Integration with 3rd Party Code
* @travetto/di Now supports injecting/declaring (via @InjectableFactory) 3rd party code

## Compiler/VScode Plugin Upgrade
* vscode-plugin Overhaul of app logic, moving to cli for execution
* vscode-plugin Rework of compiler invocation to handle invalid states better, and to provide inline progress of compilation
* @travetto/compiler Reworked exit, and signaling of progress for use by external tools


------------------------------------------------------
Release 3.2.0: 2023-06-25 -- You're an All-star
------------------------------------------------------

## Major/Breaking Changes

## Upgrade to Typescript 5.1
* Upgrade to Typescript 5.1

## Email Overhaul
* @travetto/email-template has been split into
   - @travetto/email-compiler (Takes templated content and produces the sass/image inlined files)
   - @travetto/email-inky (Now JSX components for producing email templates)

## Rest Client
* @travetto/rest-client is now a light-weight alternative to using @travetto/openapi's generator program

## Pack Rollup
* @travetto/pack now supports full customization of rollup behavior

## Model Enhancements
* @travetto/model-query, Exists now returns false on empty arrays
* @travetto/model+schema Standardized inheritance metadata and how lookups happen

## Native Fetch
* Shifted entire framework over to native fetch (default enabled as of Node 18+).  

## Auth Cleanup
* @travetto/rest-auth-jwt now allows for auto regenerating a new token depending on how close the token is to expiration.  When combined with the cookie encoder, this provides a mode in which the user will continue to renew the token, providing a semblance of the session timeout/renewal.
* @travetto/rest-auth-context has been deprecated, and this functionality is now basked into @travetto/auth-rest

## Rest/schema
* Standardization of all Query-based complex types (e.g. schema-backed objects mapped to query params) - We now have consistency between OpenAPI, Rest, and Rest-Client on how these types will be handled, and how prefixing of values will apply.

--------------------------------------------------
Release 3.4.0 - 2023-11-12 - Under the Hood
--------------------------------------------------
## Major/Breaking Changes

### Upgrade to Typescript 5.1 (finally)
* Removed stale dependency that was causing rollup to break

### Cli internal cleanup
* Cli now properly supports `--flag='--a,--b,etc..`
* Cleaned up CLI logic for processing fields

### Compiler Orchestration Overhaul
* Compiler is now `trvc`, and the cli is `trv`
* Compiler now runs a server, and interacts with the requests for compilation, relying on port allocation to ensure non-conflicting operations
* Reorganized compiler entry points to provide a more consistent experience

### File Watching Refactor
* No longer relying on file-system watching outside of the compiler
* Services can now listen to the compiler to be notified of file changes
* Some modules may directly interface with parcel/watcher if the need is greater than listening to the compiler.

### Manifest dependency graph cleanup
* Profiles were complicated, unclear and often times implicit.  Removed this as a core pattern of the framework
* Now we flag each module as prod or not
* Also track any scopes it may rely upon (removed tie-in with profiles)
* RootIndex now requires far more information when walking the file/dependency graph
   * No more magic based on runtime

### GlobalEnv
* Global env was overhauled, removing profiles, as a special pattern.
* Removed ability to add additional flags. Externalizing ownership.

### Config
* Configuration no longer tied to base
* Profiles are only used for finding files to load
* Entire loading process has been mad much clearer
* Priorities are also much clearer when loading from multiple sources

### Resource access
* Runtime resource loading is no longer a provider pattern, but explicitly aimed at only touching the file system
* Resource paths  now include the monorepo when appropriate
* Removed file system querying/searching functionality

### Schema 
* Shared generated types, and naming collisions
  * Now we tie synthetic types to function/method/class hierarchy and fallback to line number when necessary

### VSCode
* Reworked VSCode integration with all the new entrypoint behavior, and compiler changes

---------------------------------------------
Release 4.0 - 2024-2-12
---------------------------------------------

## Major/Breaking Changes
### NodeJS Alignment
* Shifted over to core nodejs logic where applicable, removed corresponding functionality

### Terminal
* No longer a core module
* Removed all terminal querying support
* Reduced available support to stream to line, at bottom and the table support

### Manifest
* Reworked structure
* Redefined how we built up the context
* Reworked how we navigate the modules for painting/role assignment
* Exposed:
   - RuntimeContext - The runtime manifest context.  This is the preferred usage for anyone that needs runtime manifest info
   - RuntimeIndex - The runtime manifest index.  This is necessary when interrogating the source at runtime
* Manifest Index is gone

### Compiler
* Reworked client support to be owned by compiler
* Added interface to cli to allow vscode to call command versus exposing complexity of client management.
* Reworked watching to use single watcher
   * Solved plenty of watch bugs
* Reworked server
   * Shutdown is now far more reliable
   * Reset/restart is now handled appropriately in all cases
   * Centralized ownership of sigint/sigkill signal to the core compiler process
   * Added in hard shutdown timeouts 
   * Added in PID tracking in case something hangs

### VSCode / Tooling Overhaul
* Reworked all integrations to push as much logic to the underlying tools
* All start/restart logic is removed and listens for the compiler state change as needed
* Source code is greatly simplified with less error states to care about in vscode (win)

### Base
* Externalized libraries that should have been elsewhere
   * DataUtil is now in Schema
   * Some Util functions are now in auth, for allow/deny matchers
* Broke apart NODE_ENV from TRV_ENV
   * TRV_ENV now defaults to package.travetto.build.defaultEnv
* Env overhaul
   * Now a typed interface for framework env
   * Compile time check
   * GlobalEnv is gone
* TimeUtil - removed unneeded logic
* StreamUtil - removed unneeded logic, defaulting to 'node:streams' in more cases
* ExecUtil - Complete rewrite
   * No longer takes responsibility for calling process.spawn
   * Expects a process to be provided, and will work with it after the fact
   * No longer defaulting options (env, stdio, cwd, etc), and is completely in the hands of the caller
* Shutdown was converted into gracefulshutdown and is aimed at supporting the expected flow.  No longer interjecting into explicit kills and the complexity that brought.
* Startup minimizes the information needed to run, and streamlined console/debug relationship.  

### Pack
* Rewrote logic for dependency packing ensuring compatibility for ESM/CommonJS


---------------------------------------------
Release 5.0 - 2024-8-26
---------------------------------------------

## Major/Breaking Changes
### NodeJS Alignment
* Shifted over to core nodejs logic where applicable, removed corresponding functionality

### Asset 
* Removed, cannibalized by model changes

### Yaml 
* Removed in favor of standard yaml install

### Base
* Renamed to Runtime
* Non-core functionality moved out
* Focused on being a layer between os and travetto
* Defer to node implementations where possible (object util, stream util)
* Moved data util to schema
* Now owns all the core transformers, manifest doesnt
   * Path should now be used as a standard import (swapped out at build time)
* Reworked how we store file ids, and access them
   * No longer depending on manifest for registering classes
* ResourceLoader is gone, only File Loader

### Compiler
* Fixed bug that killed all userland processes

### VSCode / Tooling Overhaul
* Fewer open calls to travetto cli
* Defer testing/email to run only when needed

### Pack
* Exposed ability to externalize npm modules easily

### Test
* Provide ability to tag tests, for easy exclusion/inclusion
* Shifted from regexes to globs (using node's standard glob support)
* Shuffle suites on execution (speedup and uncovers new issues)
* Fixed promise detection to properly find unresolved promises

### Model + Stream
* Model service shifted support form streams to blobs
* Removed most of the needs for the asset module
* Cleaned up data flow to ensure minimal data being loaded into memory where possible
* Aligned entire platform around blob

### Asset-Upload
* Moved to rest-upload
* Standardized on blob/file for upload
* Centralized logic for hashing/file detection to where we know we have a file on disk

### Image
* Pulled in sharp for native-node support, avoiding the external operations

---------------------------------------------
Release 6.0 - 2025-5-1
---------------------------------------------

## Major/Breaking Changes

### Auth Overhaul
* Auth system has been rewritten with respect to the modules, and the relationship with the result module
* The auth session has migrated from being the owner various contracts to the arbiter of auth state
   * AuthService/AuthContext now represent the authentication information, regardless of rest patterns
#### Jwt is gone
   * This is now integrated into auth-rest by default using njwt
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


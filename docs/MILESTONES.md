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
* FsUtil as a base
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
   * Switched over to openapitools as swagger-codegen-cli was out of date
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
* The Test  module now boasts a watachable test server, that will listen for changes in test files and automatically re-run them.  This is what is used to power the new plugin implementation.
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

#### Model Overhaul
* Asset now relies on Models with Streaming support
* Cache now relies on Models with Expiry support
* Auth-Model relies on Models alone
* S3, Firebase, Redis, Dynamo were all added as standard model providers
* All model implementations now have extension testing for the services that they are compatible with
* `asset-mongo`, and `asset-s3` are gone, and relies on a `model` provider that has streaming
* `cache/src/extension/{redis,dynamdb}` are gone and are also now model provided
* `model` is gone and has been replaced by `model-core` and `model-query`.
* `model-core` is a series of interfaces/contracts, and some minor utility functions. All ownership has been pushed to the various providers.
* Method names have been standardized as `verbNoun` e.g. `getStream` or `upsertExpiry`

#### Support for Dynamic Module references, specifically, third party
* No longer symlinking for local dev
* Allows for better testing of extensions
* Moved the source code indexing into boot to be used by the CLI
   * All support/* files are converted to .ts
   * Indexing only looks for typescript files
   * Will speedup tools that rely upon full file system scanning

#### Local Dev Overhual
* Now relies on environment variables (`direnv` makes it easier) for augmenting what would have been embedded in the framework.
* Using tsconfig paths in lieu of symlinks, general development performance, and refactoring are substantially improved.

#### Extension Overhaul (and testing thereof overhaul)
* Extensions are now tested in isolation allowing for various combinations of extensions to be tested

#### Logging overhaul (Base no longer duplicates functionality of log)
* All filtering and formatting now belong to the log module
* All log statements are encouraged to following the pattern of `message`, `{ payload }`
* Startup logs may still need some support if the goal is suppression

#### Module reorg
* `auth-passport` is gone, and is now an extension of `auth-rest`.
* `asset-*` for implementations, are now model modules
* `cache`'s built in extensions are not model modules
* Extensions have been moved to the module which owns the complexity (e.,g. schema rest support dealt more with the internals of rest than schema, and has been moved).

#### Typescript Alignment
* Shifted codebase away from use of `any` to `unknown` where applicable (over 750 instances migrated)
* Using more interfaces where possible (and less reliance on abstract clasess)
   * This allows for better control at the cost of potentially duplicated functionality
* Movingn to typescripti 4.2

#### Removed `sync` versions of `ResourceManager` methods
* All resource lookups are considered to be `async`, as runtime support for `sync` was an anti-pattern

#### Separated out configuration of which folders to scan during execution (and allowing for soft optional)
* This has the affect of removing a bunch of custom logic around tests
* Alt folders have been removed, and can be emulated by specifying `TRV_SRC_LOCAL` values as needed.

### New Features
* Updated boot to allow for user provided registration hoooks via `TRV_REQUIRES`

### Non-Breaking Changes

#### Standard dependency upgrades

#### Lessened dependency on bash scripts, and moved build processes over to nodesh
* Local developmentshould now support windows, but there may still be a few edge cases

#### Docs have been converted back to typescript, and the doc folders have been simplified
* Proper typechecking on all docs
* Renamed file from DOCS.js to doc.ts
# Travetto 2.0 Release Notes

> Release 2.0.0: 2021-02-01 -- Model Rewrite

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

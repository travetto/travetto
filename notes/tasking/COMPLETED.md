Completed Tasks
==============

Development
----------------------
- [x] allow for better alignment with `tsc` and remove unneeded symlink logic

Model (Cache, Asset, Auth)
----------------------
[x] Move all data oriented operations into the model module
  - [x] update down stream activities to rely on the new contracts
  - [x] beef up testing considerably for various implementations

Worker
----------------------
[x] Use worker threads in lieu of IPC (should be more robust)
  - [x] Rework @trv/worker (Used where possible)
  - [x] Rework CLI invocation (Used where possible, limitations for CLI operations)

Pack
----------------------
[x] Build in packing support, with a focus on space optimization for lambdas

Watch
----------------------
[x] Extract watch to it's own package, as it's dev only

Compiler
----------------------
- [x] Support type checking in transformers
  - [x] Investigate auto creating schemas from interfaces for simple one offs  

General
--------------------------
- [x] Reorganize rest module
- [x] Consider transformer as a separate module
- [x] General support for fork/spawn, standardize on a single approach
- [x] File Cache move to base?
- [x] Cleanup general index to ensure only public api is exposed
- [x] Standardize /bin/ contents naming and structure
- [x] Move as much of /bin/ code into /src/ as possible

Transformers
------------------------
- [x] Support type checking in transformers
  - [x] Convert schema/rest/swagger/test/config/cache/application to use resolved type information
  - [x] Rewrite test module/plugin to work with new compiler architecture

Model
----------------------
- [x] Basic aggregation support, to get model counts by a specific attribute

Caching
-----------------------
- [x] Rework cache infrastructure to allow for multiple providers
- [x] Integrate caching with
    - [x] File System
    - [x] Redis
    - [x] Memory
    - [x] Model Service
- [x] See if we can integrate with asset service
- [x] See if we can integrate with session store

Assets
-----------------------
- [x] Naming structure for assets
- [x] File provider
- [x] Separate Image processing out of asset

Base
----------------------
- [x] Separate out e2e into a better pattern
- [x] Remove dependency on dev/test
- [x] Unify path usage, default to URI model and convert to local path when needed, look into upath

Model Elasticsearch
-----------------------
- [x] Upgrade to latest client, and convert code to support all
- [x] Regex as strings wrt to binding and schema validation
- [x] Schema config for text field arrays
- [x] Migrated to new elasticsearch client as old one was deprecated

Model SQL
----------------------
- [x] Building out SQL model support
  - [x] Add tests to base for 'replace' mode of deepAssign
  - [x] Support mysql/postgres as first pass
  - [x] Figure out paradigm for ownership of namespacing
  - [x] Basic polymorphism support
  - [x] Sorting/paging
  - [x] Handle schema changes (columns added removed)
- [x] Resolve issues with multiple tests from same file

Exec
-----------------------
- [x] Modify spawn to take in command and args, not full string

Tests
-------------------
- [x] Test runner returning non-0 exit code

Communication
--------------
- [x] Blog Post about 
  - [x] CLI
  - [x] Generator
  - [x] Lambda Goals
  - [x] Model SQL status
  - [x] Model query language support
- [x] Website 
  - [x] Landing Screen Images
  - [x] Docs
  - [x] Getting Started
- [x] Initial Announce
  - [x] Blog
  - [x] Twitter
  - Friends/Coworkers

Documentation
-----------------------
- [x] Getting Started
- [x] Overview
- [x] General Docs
- [x] Github project
  - [x] Basic Pass at README
  - [x] Project title/topics
  - [x] Deeper README  
- [x] Reorganize Docs into high level groupings
- [x] Rewrite Docs (v2):
  - [x] base
  - [x] config
  - [x] log    
  - [x] exec
  - [x] schedule
  - [x] util
  - [x] cache
  - [x] compiler
  - [x] context
  - [x] registry
  - [x] schema
  - [x] asset
  - [x] asset-mongo
  - [x] asset-rest
  - [x] asset-s3
  - [x] rest
  - [x] rest-aws-lambda
  - [x] rest-express
  - [x] rest-fastify
  - [x] rest-koa
  - [x] swagger
  - [x] model
  - [x] model-elasticsearch
  - [x] model-mongo
  - [x] auth
  - [x] auth-model
  - [x] auth-passport
  - [x] auth-rest
  - [x] di
    - [x] Document @Application
  - [x] email
  - [x] email-template
  - [x] test
  - [x] cli      
  - [x] generator-app
    - [x] Document Yeoman Generator
  - [x] Overview diagram    
  - [x] Integrate with Getting Started with yeoman generator

Model Library
--------------
- [x] General
  - [x] Query Language Support
- [x] Elasticsearch
  - [x] Schema management
- [x] Partial Updates/Query Updates
   - [x] Set updates 

Schema
-----------------------
- [x] Views, exclude fields vs include

Library Reduction
---------------
- [x] JWT Lib
- [x] YAML lib
- [x] Remove Email Dependencies
  - [x] Rewrite Inky in parse5
  - [x] Migrate tests
  - [x] Deprecate custom inky branch

Rest Support
-----------------
- [x] HTTP/2
- [x] Koa
- [x] Add Swagger generation  
- [x] Enable host name override for applications

User Tooling
--------------------
- [x] Yeoman Generator
  - [x] Generate Rest app
  - [x] Generate Model app
  - [x] Generate Rest - [x] Model app
- [x] CLI Streamlined
  - [x] Convert all current CLI scripts into cohesive unit
  - [x] Create new CLI experience for Swagger
  - [x] Create new CLI for email template testing/compiling
- [x] Plugin Features
  - [x] Rerun all tests via command
  - [x] Export application setup for more config
  - [x] Provide debug config for plugin
  - [x] Test failures, and "stuckness"

Auth Support
------------------------
- [x] Auth Module
 - [x] OAuth support
 - [x] Rewrite st
- [x] Move to JWT as session store, prep for Lambda
 
DI
----------------------
- [x] Prevent duplicate constructions via different targets
  - Rewrite module to align with consistency of naming

Platform Support
------------------------
- [x] Compilation
  - [x] Test Loading/Unloading
  - [x] Test auto import? or restrict completely
- [x] Logging
  - [x] General Strategy
    - [x] DEBUG - Low frequency, but low level
    - [x] TRACE - Low level, but high frequency
    - [x] INFO - High level and useful
  - [x] Error messaging
  - [x] Modules
    - [x] Base
    - [x] Compiler
    - [x] Registry
    - [x] Dependency
    - [x] Express
    - [x] Util
- [x] Error management, catastrophic errors need to propagate
  - [x] Updated test plugin
  - [x] use Env.error when possible
  - [x] force pieces through the shutdown process
  - [x] Handle exit locations in the CLI (test/run)
  - [x] Expose compilation errors
  - [x] Expose transpilation errors
- [x]  Win32 Platform Issues
  - [x] Path issues
    - [x] Cache functionalityfiles
    - [x] Bulk require
    - [x] Bulk read
    - [x] Stack traces
       - [x] Output
       - [x] Testing
    - [x] Transformers file names
    - [x] Logging file names
  - [x] Execution
    - [x] Must have node at front at all times
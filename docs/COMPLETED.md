Completed Tasks
==============

Base
----------------------
- [X] Separate out e2e into a better pattern
- [X] Remove dependency on dev/test
- [X] Unify path usage, default to URI model and convert to local path when needed, look into upath

Model Elasticsearch
-----------------------
- [X] Regex as strings wrt to binding and schema validation
- [X] Schema config for text field arrays

Exec
-----------------------
- [X] Modify spawn to take in command and args, not full string

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
 - [x] Rewrite starter

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
Active Development
=============

Compiler
----------------------
- [ ] Support type checking in transformers
  - [ ] Convert schema/rest/swagger/model/application to use resolved type information
  - [ ] Investigate auto creating schemas from interfaces for simple one offs

Serverless Initiative
--------------------------
- [ ] Lambda for REST
  - [x] Entire rest app as an AWS lambda
  - [x] Individual routes as individual lambdas
  - [x] API Gateway configuration
  - [ ] Auto deployment of application
  - [x] CLI entry point to facilitate

Caching
-----------------------
- [ ] Rework cache infrastructure to allow for multiple providers
- [ ] Integrate caching with
      * File System
      * Redis
      * Memory
      * Model Service
      
Tests
--------------
- [?] Better unit tests

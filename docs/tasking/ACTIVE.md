Active Development (1.0.0 - RC Ready)
=====================================

SQL
-----------------------
- [ ] Resolve issues with multiple tests from same file

Caching
-----------------------
- [X] Rework cache infrastructure to allow for multiple providers
- [X] Integrate caching with
    X File System
    * Redis
    X Memory
    * Model Service
- [ ] See if we can integrate with asset service
- [ ] See if we can integrate with session store

Serverless Initiative
--------------------------
- [ ] Lambda for REST
  - [ ] Convert over to terraform
  - [ ] Support AWS/GCP and Azure
  - [x] Entire rest app as an AWS lambda
  - [x] Individual routes as individual lambdas
  - [x] API Gateway configuration
  - [ ] Auto deployment of application
  - [x] CLI entry point to facilitate

Tests
--------------
- [?] Better unit tests

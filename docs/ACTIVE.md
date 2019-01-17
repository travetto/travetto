In-Progress
=============

Rework Env
--------------
- [?] Remove dependency on dev/test
- [ ] Unify path usage, default to URI model and convert to local path when needed, look into upath

Tests
--------------
- [?] Better unit tests

Tooling
-----------------------
- [ ] Yeoman Generator Full Rewrite
  - [ ] Provide better mechanism for getting proper version
  - [ ] Handle cross dependencies
  - [ ] Provide better inputs for controlling name of packages/folders
  - [ ] Move tests to devDependencies

Serverless Initiative
--------------------------
- [ ] Lambda for REST
  - [x] Entire rest app as an AWS lambda
  - [x] Individual routes as individual lambdas
  - [x] API Gateway configuration
  - [ ] Auto deployment of application
  - [x] CLI entry point to facilitate

Model Enhancements
--------------------------
- [ ] SQL - as a doc store, limited functionality
  - [ ] Model support for SQL databases
  - [ ] Might need to be a whole new set of sql operations
  - [x] Using Sequelize?
  - [x] Already supports most of the needed features, might be an easy win  

Auth
--------------------------
- [ ] Move to JWT as session store, prep for Lambda

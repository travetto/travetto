Pipelined Tasks
==============

Plugin Enhancements
--------------------------
- [ ] Test failures, and "stuckness"
- [ ] Rerun all tests via command
- [ ] Export application setup for more config
- [ ] Provide debug config for plugin

Model Enhancements
-----------------------
- [ ] Elasticsearch Support
  - [ ] Extended query language
- [ ] SQL - as a doc store, limited functionality
  - [ ] Model support for SQL databases
  - [ ] Might need to be a whole new set of sql operations
  - [x] Using Sequelize?
  - [x] Already supports most of the needed features, might be an easy win  

Serverless Initiative
--------------------------
- [ ] Lambda for REST
  - Move to JWT as session store, prep for Lambda
  - [x] Entire rest app as an AWS lambda
  - [x] Individual routes as individual lambdas
  - [x] API Gateway configuration
  - [ ] Auto deployment of application
  - [x] CLI entry point to facilitate
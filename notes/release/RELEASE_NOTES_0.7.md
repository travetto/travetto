# Travetto 0.7 Release Notes

> Release 0.7.x: 2019-07-15 -- BETA --

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

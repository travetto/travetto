# Registry Unification (v2)

The goal of registry unification falls under the following ideals:
* Removing duplicate areas of functionality within the framework
* Clarify the lifecycle for loading classes:
   1. Registration
   1. Finalization - Local
   1. Finalization - Global
* Clarify the lifecycle for live loading
   1. Same as above
* Decrease the number of transformers, in preparation for the migration to GoLang that
  Typescript is moving to with version 7. Ideally all that should be needed is:
   1. Schema
   1. Assertion
   1. Runtime (base)


## Architectural Changes
The main changes with this RFC will be:

### Single Registry
The merging of Root + Metadata Registry into a single registry represents the main ideological shift for this change.  Instead of having nested hierarchies with dependencies, there will be a single registry. 

This newly combined registry will have zero knowledge of the various use cases, and will only concern itself with "classes" though functions will be supported in the future.  Functions can be thought of as a "class with a single function/constructor". 

### Lifecycle Clarity
The registry will operate with the following patterns:

#### Registration
This is the registration phase that occurs before the application is marked as "ready".  In production (without live reload), this is the only registration phase that will ever run.  Initial registration is when:
* All files matching the desired pattern are loaded
* Every class that is loaded (and has decorators) will self register the appropriate metadata. None of the registrations should presume knowledge of registration types (e.g. schema + model).
* The initial loaded data is registered as "pending" meaning that it is not finalized.

After every classes is visited/loaded the registry will trigger finalization.

#### Finalization - Local
During finalization, all pending metadata is resolved for a single Service (e.g. model, schema) and a single class.  All finalizations should run in the order of registration, which would run in import order.  This means parents should be finalized before children, inherently.  So when finalizing a child, the parent should already be finalized.

#### Finalization - Global
After each service is considered internally consistent, there is opportunity for global finalization, if there are any cross service dependencies (e.g. model > schema).  

#### Live Registration
Live registration is the above process, but only for the newly added classes.  One of the key pieces here is that the previous state will be preserved until finalization.

### Eventing
During the above lifecycle events there will be opportunities to emit various events, replacing the per registry event handling.  This will allow for discrete/focused events that each data type is responsible is for.
 * Web listens for updated controllers
 * OpenAPI listens for updated controllers/schemas
 * Test listens for changes to files that don't include classes
 * RPC listens for changes to controllers
 * Model Storages listens for changes to models to CRUD the types, when appropriate


### Transformers
The following transformers will be rewritten as purely decorators, with any necessary functionality moving to the schema transformer:
* Dependency Injection - Will need to record the constructor details, and store metadata for qualifiers
* Web - Will need to move most of the logic to finalization, and ensure we are recording all the necessary details (e.g. Promise and inner type for methods).
* Documentation - Method/classes utilize a common pattern for all classes to apply basic documentation


### Externalized Helpers
Currently DI, Model, Schema, Test, Controller all have registries that rely on their own unique scoping.  
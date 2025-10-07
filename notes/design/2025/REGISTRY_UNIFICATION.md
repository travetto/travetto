# Registry Unification

## Usage of `MetadataRegistry` in the Project

The `MetadataRegistry` is a core utility for managing and querying metadata across various modules. Below are the main instances where it is used, excluding toy or illustrative examples:

### 1. Schema
Registers all "schema" classes used for binding type information for classes, methods, and properties.

### 2. Dependency Injection
Tracks service lifecycles, scopes, and dependencies for runtime resolution.

### 3. Web Controller Registration
Enables dynamic route discovery and request handling.

### 4. Test Suite Registration
Enables test suite registration.


## Current Architecture

The current structure of the MetadataRegistry is meant to be generally abstract with support of Parent/Child relationship, e.g. Suite/Test, or Controller/Endpoint.  This is generally sufficient, but does lack flexibility when access to more levels of information is needed.

## Proposal
The goal for all of these registries, is to consolidate into a single clear registry that has the ability to serve all of these needs.

### Primary Changes
1. Registry will now support
* Class level organization (common throughout all four current implementations)
* Method level organization (common in some)
* Constructor level organization (used by DI)
* Field level organization (common in some)

2. Ability to register scoped metadata (usually behind symbols). Allow each logical registry to add its own metadata:
* What to do on initialization (Driven by decorators)
* What to do on finalization (Driven by decorators)

3. Expose some external helper method suites to help mimic the current access patterns of the existing registries
* Will be util classes that take place of the registry.

4. All transformer logic will need to be adjusted and aligned to live mostly in the schema module
* Web still has enough complexity that it will need to remain
* Test will remain for assertions only
* DI should be able to entirely be replaced

5. Ability to listen to changes with explicit metadata, and assume certain contracts
* This will remove all nesting/dependent registration
* Order of operations matter, may need to explicitly define ordering to ensure conflict handling

6. Root Registry could get merged with schema, making Schema the standard registry.
* Or, schema just becomes another consumer of the class/field information.  
* We need type information so the transformer would need to be at the schema level
* Maybe registry just goes away?
* Would need to refactor registry/schema, maybe unify


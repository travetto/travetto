# Transformers Used in Code base
The following transformers are used, and listed in order of precedence:

## test - transformer.annotate.ts
Scope: Method/Class
Purpose: Record line number ranges for reporting during tests
Effect: Updates @Suite/@Test metadata with line number ranges
Restriction: Only for source files in test folders

## log - transformer.logger.ts
Scope: Function call, console.*
Purpose: To transform console.* calls into log service invocations
Effect: Imports Log service, transforms console.* calls
Restriction: In prod mode, console.debug, console.trace statements will be purged to improve performance

## test - transformer.assert.ts
Scope: Function call, assert, assert.*
Purpose: To decorate assert calls with additional information
Effect: Imports assert utils, and rewrites code to support
Restriction: Only for source files in test folders

## registry - transformer.class-metadata.ts
Scope: Class/Method
Purpose: To provide unique identifies, and metadata to denote if classes have changed or not, and if methods have changed or not
Effect: Classes will have metadata declared 

## di - transformer.injectable.ts
Scope: Class, static method
Purpose: To declare classes/static functions as injectable, and to register declared dependencies as needing to be injected
Effect:  Classes with @Injectable (or the like) will be registered as injectable, and will have all it's dependencies declared

## app - transformer.application.ts
Scope: Class, method
Purpose: To denote application entry points, and to allow for clean invocation with enforcement of types for invocation parameters
Effect:  Classes with @Application (or the like) will be registered as entry points, and will be able to be invoked from the command line

## rest - transformer.endpoint.ts
Scope: Method
Purpose: To record dependencies of rest endpoints, and provide mechanisms for binding query/form/body/header/session/etc. data into the endpoint
    in lieu of sending in data as Request/Response.
Effect: All rest endpoints will have their parameter metadata exposed for inspection and invocation at runtime

## schema - transformer.schema.ts
Scope: Class, Method
Purpose: To define, and record the structure of specific classes intended to be used as schemas.  Will automatically infer schema information
    from types, default variables, etc.
Effect: Will import schema access, All schema classes will be defined and type information provided appropriately

## config - transformer.config.ts
Scope: Class, Property
Purpose: To provide mechanism for supporting ENV vars when intermediate values are not set.
Effect: None atm

## cache - transformer.config.ts
Scope: Method
Purpose: Wrap @Cache/@Evict methods while preserving original method.
Effect: Caching will work seamlessly, with the benefit of maintaining original method.
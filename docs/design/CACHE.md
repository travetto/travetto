# Caching

The entire goal of caching, within the framework, is to prevent recomputation of complex operations, and to minimize number of additional hops a request may need to succeed.

At a basic level, initially, caching will be single level with a centralized repository for validation and invalidation.  As the module grows, the expectation will be a multi-level cache (think L1/L2 on a processor) that will leverage local ram as well as an external caching store.

## Implementations
The caching mechanism, if involving any networking, will require all methods to be asynchronous.  Caching will require a key, that should be derived from the function invocation, or customizable via function.

## Namespacing
Caching should be configurable at the method or at the class level.  Eviction should also be at the namespace level. 

## Eviction
Eviction should be able to be time-based for how long something should be allowed to survive. Other metrics (memory/count) do not scale well in a distributed system.  All the information needed for eviction, should be localized to the entry itself.

## Serialization
Serialization needs to account for complex structures, and should be able to rely upon `JSON.stringify` for storage.  There is potentiality for detecting return types and allowing for recreating the objects that were persisted.  Streamed data should be stored in a format that is amenable for streaming as well.

## Errors
Error states should be cacheable as well, if desired.  These need to be evictable, but can prove useful for situations where the resources it takes to verify something is missing are expensive.

## Stores
* Disk   - Core
* Memory - Core
* Redis  - Module
* Asset? - Extension
* Model? - Extension
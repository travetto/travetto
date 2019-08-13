# Caching

The entire goal of caching, within the framework, is to prevent recomputation of complex operations, and to minimize number of additional hops a request may need to succeed.

At a basic level, initially, caching will be single level with a centralized repository for validation and invalidation.  As the module grows, the expectation will be a multi-level cache (think L1/L2 on a processor) that will leverage local ram as well as an external caching store.

## Implementations
The caching mechanism, if involving any networking, will require all methods to be asynchronous.  Caching will require a key, that should be derived from the function invocation, or customizable via function.

## Namespacing
Caching should be configurable at the method or at the class level
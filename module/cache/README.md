travetto: Cache
===

Provides a simple wrapper around `lru-cache` to provide standard caching constructs.  

`Cacheable` is a decorator that allows caching at class methods. The decorator will rewrite the method
to cache on successful results. The decorator supports synchronous as well as asynchronous methods.

```typescript
  class Worker {
    
    @Cacheable({ max: 1000 })
    async calculateExpensiveResult(expression: string) {
      const value = await request(`https://google.com?q=${expression}`);
      return value;
    }
  }
```

The `Cacheable` decorator supports certain configurations:
* `name` the name of the cache space
* `dispose` the function to invoke on cache eviction
* `keyFn` the function used to determine the cache key, defaults to all params serialized to a string
* `max` the maximum number of elements that the cache will hold before eviction
* `maxAge` the longest time an element is allowed to live before eviction.  Defaults to infinite.
travetto: Cache
===

Provides a simple wrapper around `lru-cache` to provide standard caching constructs.  

Provides a decorator to allow caching at the method level throughout the system.  Will rewrite the method
to cache on successful responses.

```typescript
  class Worker {
    
    @Cacheable({ max: 1000 })
    calculateExpensiveResult(expression: string) {
      ...
      return value;
    }
  }
```

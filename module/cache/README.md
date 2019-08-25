travetto: Cache
===

**Install: primary**
```bash
$ npm install @travetto/cache
```

Provides a foundational structure for integrating caching at the method level.  This allows for easy extension with a variety of providers, and is usable with or without [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di).  The code aims to handle use cases surrounding common/basic usage.

## Decorators
The caching framework provides method decorators that enables simple use cases.  One of the requirements to use the caching decorators is that the method arguments, and return values need to be serializable into JSON, or are a node Readable stream.  Any other data types are not currently supported and would require manual usage of the caching services directly.

Additionally, to use the decorators you will need to have a [`CacheStore`](./src/store/types.ts) object accessible on the class instance. This can be dependency injected, or manually constructed. The decorators will detect the field at time of method execution, which decouples construction of your class from the cache construction.

`@Cache` is a decorator that will cache all successful results, keyed by a computation based on the method arguments.  Given the desire for supporting remote caches (e.g. redis, memcached), only asynchronous methods are supported. Though if you do have a cache store that is synchronous, you can use it directly to support synchronous workloads.

**Code: Using decorators to cache expensive async call**
```typescript
  class Worker {
    
    myCache = new MemoryCacheStore();

    @Cache('myCache', { maxAge: 1000 })
    async calculateExpensiveResult(expression: string) {
      const value = await request(`https://google.com?q=${expression}`);
      return value;
    }
  }
```

### @Cache
The `@Cache` decorator supports configurations on:
* `name` the field name of the current class which points to the desired cache store.
* `config` the additional/optional config options, on a per invocation basis
  * `keySpace` the key space within the cache.  Defaults to class name plus method name.
  * `key` the function  will use the inputs to determine the cache key, defaults to all params `JSON.stringify`ied
  * `params` the function used to determine the inputs for computing the cache key.  This is an easier place to start to define what parameters are important in caching. This defaults to all inputs.
  * `maxAge` the number of milliseconds will hold the value before considering the cache entry to be invalid.  By default values will live infinitely.
  * `extendOnAccess` determines if the cache timeout should be extended on access.  This only applies to cache values that have specified a `maxAge`.
  * `transform` the function to execute on return of a cached value.  This allows for any necessary operations to conform to expected output (e.g. re-establishing class instances, etc.).  This method should not be used often, as the return values of the methods should naturally serialize to/from `JSON` and the values should be usable either way.

### @EvictCache

Additionally, there is support for planned eviction via the `@EvictCache` decorator.  On successful execution of a method with this decorator, the matching keySpace/key value will be evicted from the cache.  This requires coordination between multiple methods, to use the same `keySpace` and `key` to compute the expected key.

**Code: Using decorators to cache/evict user access**
```typescript
  class UserService {
    
    myCache = new MemoryCacheStore();

    @Cache('myCache', { keySpace: 'user.id' })
    async getUser(id: string) {
      return database.lookupUser(id);
    }

    @EvictCache('myCache', { keySpace: 'user.id', params: user => [user.id] })
    async updateUser(user: User) {
      ... update user ...
    }

    @EvictCache('myCache', { keySpace: 'user.id' })
    async deleteUser(userId: string) {
      ... delete user ...
    }
  }
```


## Building a Custom Store
The module comes with a [`MemoryCacheStore`](./src/store/memory.ts) and a [`FileCacheStore`](./src/store/file.ts). The module also has extension for a [`Redis`] store and [`Model`](https://github.com/travetto/travetto/tree/master/module/model)-backed store.  

**Code: Primary Store structure**
```typescript
export abstract class CacheStore {
  abstract get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  abstract has(key: string): Promise<boolean> | boolean;
  abstract set(key: string, entry: CacheEntry): Promise<any> | any;
  abstract delete(key: string): Promise<boolean> | boolean;

  abstract isExpired(key: string): Promise<boolean> | boolean;
  abstract touch(key: string, expiresAt: number): Promise<boolean> | boolean;
  abstract keys(): Promise<Iterable<string>> | Iterable<string>;

  clear?(): Promise<void> | void;

  postConstruct?(): Promise<void> | void;
}
```

For the store, all abstract methods must be implemented. All of the more complex logic is implemented in other methods within the base `CacheStore`.   The structure follows that of the javascript `Map` class for consistency. All that is needed is basic input/output support:

* `get(key: string)` - Fetch entry from store, and return in the structure of an entry, ready to go
* `has(key: string)` - Indicates whether or not the key exists
* `set(key: string, entry: CacheEntry)` - Stores entry, given `key`.  
* `delete(key: string)` - Removes entry by key
* `isExpired(key: string)` - Determines if entry is expired
* `touch(key: string, expiresAt: number)` - Updates expiry information to date provided
* `keys()` - Returns list of all keys in the store

Additionally, for setting/getting the burden is on the store author to properly serialize/deserialize as needed.  This is a low level detail and cannot be accounted for in a generic way.

**Code: MemoryStore**
```typescript
export class MemoryCacheStore extends CacheStore {
tore = new Map<string, T>();

  clear() { this.store.clear(); }

  keys() { return this.store.keys(); }

  has(key: string) { return this.store.has(key); }

  delete(key: string){ return this.store.delete(key); }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry) {
      return this.postLoad(entry);
    }
  }

  async set(key: string, entry: T): Promise<void> {
    this.cull();

    entry = await this.prePersist(entry);

    this.store.set(key, entry);

    return this.postLoad(entry).data;
  }

  touch(key: string, expiresAt: number): boolean {
    this.store.get(key)!.expiresAt = expiresAt;
    return true;
  }

  isExpired(key: string) {
    const entry = this.store.get(key);
    if (entry) {
      return !!entry.maxAge && entry.expiresAt! < Date.now();
    }
    return false;
  }
}
```

The memory store is simple but illustrates the structure well.
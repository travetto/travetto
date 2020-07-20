const { doc: d, Code, Section, List, inp, meth, Mod, SubSection, lib } = require('@travetto/doc');
const { CacheSource } = require('./src/source/core');
const { Cache, EvictCache } = require('./src/decorator');
const { MemoryCacheSource } = require('./src/source/memory');
const { FileCacheSource } = require('./src/source/file');

exports.text = d`
Provides a foundational structure for integrating caching at the method level.  This allows for easy extension with a variety of providers, and is usable with or without ${Mod('di')}.  The code aims to handle use cases surrounding common/basic usage.

${Section('Decorators')}
The caching framework provides method decorators that enables simple use cases.  One of the requirements to use the caching decorators is that the method arguments, and return values need to be serializable into JSON.  Any other data types are not currently supported and would require either manual usage of the caching services directly, or specification of serialization/deserialization routines in the cache config.

Additionally, to use the decorators you will need to have a ${CacheSource} object accessible on the class instance. This can be dependency injected, or manually constructed. The decorators will detect the field at time of method execution, which decouples construction of your class from the cache construction.

${Cache} is a decorator that will cache all successful results, keyed by a computation based on the method arguments.  Given the desire for supporting remote caches (e.g. ${lib.Redis}, ${lib.Memcached}), only asynchronous methods are supported. Though if you do have a cache source that is synchronous, you can use it directly to support synchronous workloads.

${Code('Using decorators to cache expensive async call', 'alt/docs/src/async.ts')}

${SubSection(d`${Cache}`)}

The ${Cache} decorator supports configurations on:

${List(
  d`${inp`name`} the field name of the current class which points to the desired cache source.`,
  d`${inp`config`} the additional/optional config options, on a per invocation basis ${List(
    d`${inp`keySpace`} the key space within the cache.  Defaults to class name plus method name.`,
    d`${inp`key`} the function  will use the inputs to determine the cache key, defaults to all params ${meth`JSON.stringify`}ied`,
    d`${inp`params`} the function used to determine the inputs for computing the cache key.  This is an easier place to start to define what parameters are important in ,caching. This defaults to all inputs.`,
    d`${inp`maxAge`} the number of milliseconds will hold the value before considering the cache entry to be invalid.  By default values will live infinitely.`,
    d`${inp`extendOnAccess`} determines if the cache timeout should be extended on access.  This only applies to cache values that have specified a ${inp`maxAge`}.`,
    d`${inp`serialize`} the function to execute before storing a cacheable value.  This allows for any custom data modification needed to persist as a string properly.`,
    d`${inp`reinstate`} the function to execute on return of a cached value.  This allows for any necessary operations to conform to expected output (e.g. re-establishing class instances, etc.).  This method should not be used often, as the return values of the methods should naturally serialize to/from ${inp`JSON`} and the values should be usable either way.`
  )}`
)}

${SubSection(d`${EvictCache}`)}

Additionally, there is support for planned eviction via the ${EvictCache} decorator.  On successful execution of a method with this decorator, the matching keySpace/key value will be evicted from the cache.  This requires coordination between multiple methods, to use the same ${inp`keySpace`} and ${inp`key`} to compute the expected key.

${Code('Using decorators to cache/evict user access', 'alt/docs/src/evict.ts')}

${Section('Building a Custom Source')}

The module comes with a ${MemoryCacheSource} and a ${FileCacheSource}. The module also has extension for a ${lib.Redis} source and ${Mod('model')}-backed source.

${Code('Cache Source Structure', CacheSource.ᚕfile, true)}

For the source, all abstract methods must be implemented. All of the more complex logic is implemented in other methods within the base ${CacheSource}.   The structure follows that of the javascript ${inp`Map`} class for consistency. All that is needed is basic input/output support:

${List(
  d`${meth`get(key: string)`} - Fetch entry from source, and return in the structure of an entry, ready to go`,
  d`${meth`has(key: string)`} - Indicates whether or not the key exists`,
  d`${meth`set(key: string, entry: CacheEntry)`} - Sources entry, given ${inp`key`}.`,
  d`${meth`delete (key: string)`} - Removes entry by key`,
  d`${meth`isExpired(key: string)`} - Determines if entry is expired`,
  d`${meth`touch(key: string, expiresAt: number)`} - Updates expiry information to date provided`,
  d`${meth`keys()`} - Returns list of all keys in the source`,
)}

Additionally, for setting/getting the burden is on the source author to properly serialize/deserialize as needed.  This is a low level detail and cannot be accounted for in a generic way.

${Code('MemoryCacheSource', MemoryCacheSource.ᚕfile)}

The memory source is simple but illustrates the structure well.
`;
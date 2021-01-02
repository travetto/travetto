const { doc: d, Code, Section, List, inp, meth, Mod, SubSection, lib } = require('@travetto/doc');
const { Cache, EvictCache } = require('./src/decorator');
const { CacheService, CacheModelSym } = require('./src/service');

exports.text = d`
Provides a foundational structure for integrating caching at the method level.  This allows for easy extension with a variety of providers, and is usable with or without ${Mod('di')}.  The code aims to handle use cases surrounding common/basic usage.

${Section('Decorators')}
The caching framework provides method decorators that enables simple use cases.  One of the requirements to use the caching decorators is that the method arguments, and return values need to be serializable into JSON.  Any other data types are not currently supported and would require either manual usage of the caching services directly, or specification of serialization/deserialization routines in the cache config.

Additionally, to use the decorators you will need to have a ${CacheService} object accessible on the class instance. This can be dependency injected, or manually constructed. The decorators will detect the field at time of method execution, which decouples construction of your class from the cache construction.

${Cache} is a decorator that will cache all successful results, keyed by a computation based on the method arguments.  Given the desire for supporting remote caches (e.g. ${lib.Redis}, ${lib.Memcached}), only asynchronous methods are supported.

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

${Section('Extending the Cache Service')}

By design, the ${CacheService} relies solely on the ${Lib('model')} module.  Specifically on the ModelExpirySupport.   This combines basic support for CRUD as well as knowledge of how to manage expirable content.  Any ModelService that honors these contracts is a valid candidate to power the ${CacheService}.  The ${CacheService} is expecting the ModelService to be registered using the CacheModelSym:

${Code('Registering a Custom Model Source', 'alt/docs/src/custom.ts')}

`;
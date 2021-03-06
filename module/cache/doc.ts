import { d, mod, lib } from '@travetto/doc';
import { FileModelService, MemoryModelService } from '@travetto/model';
import { DynamoDBModelService } from '@travetto/model-dynamodb';
import { MongoModelService } from '@travetto/model-mongo';
import { ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { RedisModelService } from '@travetto/model-redis';
import { SQLModelService } from '@travetto/model-sql';
import { S3ModelService } from '@travetto/model-s3';

import { Links } from '@travetto/model/support/doc-support';

import { Cache, EvictCache } from './src/decorator';
import { CacheModelⲐ, CacheService } from './src/service';

export const text = d`
${d.Header()}

Provides a foundational structure for integrating caching at the method level.  This allows for easy extension with a variety of providers, and is usable with or without ${mod.Di}.  The code aims to handle use cases surrounding common/basic usage.

The cache module requires an ${Links.Expiry} to provide functionality for reading and writing streams. You can use any existing providers to serve as your ${Links.Expiry}, or you can roll your own.

${d.Install('provider', '@travetto/model-{provider}')}

Currently, the following are packages that provide ${Links.Expiry}:
${d.List(
  d`${mod.Model} - ${FileModelService}, ${MemoryModelService}`,
  d`${mod.ModelDynamodb} - ${DynamoDBModelService}`,
  d`${mod.ModelElasticsearch} - ${ElasticsearchModelService}`,
  d`${mod.ModelMongo} - ${MongoModelService}`,
  d`${mod.ModelRedis} - ${RedisModelService}`,
  d`${mod.ModelS3} - ${S3ModelService}`,
  d`${mod.ModelSql} - ${SQLModelService}`,
)}

${d.Section('Decorators')}
The caching framework provides method decorators that enables simple use cases.  One of the requirements to use the caching decorators is that the method arguments, and return values need to be serializable into ${lib.JSON}.  Any other data types are not currently supported and would require either manual usage of the caching services directly, or specification of serialization/deserialization routines in the cache config.

Additionally, to use the decorators you will need to have a ${CacheService} object accessible on the class instance. This can be dependency injected, or manually constructed. The decorators will detect the field at time of method execution, which decouples construction of your class from the cache construction.

${Cache} is a decorator that will cache all successful results, keyed by a computation based on the method arguments.  Given the desire for supporting remote caches (e.g. ${lib.Redis}, ${lib.Memcached}), only asynchronous methods are supported.

${d.Code('Using decorators to cache expensive async call', 'doc/async.ts')}

${d.SubSection(d`${Cache}`)}

The ${Cache} decorator supports configurations on:

${d.List(
  d`${d.Input('name')} the field name of the current class which points to the desired cache source.`,
  d`${d.Input('config')} the additional/optional config options, on a per invocation basis ${d.List(
    d`${d.Input('keySpace')} the key space within the cache.  Defaults to class name plus method name.`,
    d`${d.Input('key')} the function  will use the inputs to determine the cache key, defaults to all params ${d.Method('JSON.stringify')}ied`,
    d`${d.Input('params')} the function used to determine the inputs for computing the cache key.  This is an easier place to start to define what parameters are important in ,caching. This defaults to all inputs.`,
    d`${d.Input('maxAge')} the number of milliseconds will hold the value before considering the cache entry to be invalid.  By default values will live infinitely.`,
    d`${d.Input('extendOnAccess')} determines if the cache timeout should be extended on access.  This only applies to cache values that have specified a ${d.Input('maxAge')}.`,
    d`${d.Input('serialize')} the function to execute before storing a cacheable value.  This allows for any custom data modification needed to persist as a string properly.`,
    d`${d.Input('reinstate')} the function to execute on return of a cached value.  This allows for any necessary operations to conform to expected output (e.g. re-establishing class instances, etc.).  This method should not be used often, as the return values of the methods should naturally serialize to/from ${d.Input('JSON')} and the values should be usable either way.`
  )}`
)}

${d.SubSection(d`${EvictCache}`)}

Additionally, there is support for planned eviction via the ${EvictCache} decorator.  On successful execution of a method with this decorator, the matching keySpace/key value will be evicted from the cache.  This requires coordination between multiple methods, to use the same ${d.Input('keySpace')} and ${d.Input('key')} to compute the expected key.

${d.Code('Using decorators to cache/evict user access', 'doc/evict.ts')}

${d.Section('Extending the Cache Service')}

By design, the ${CacheService} relies solely on the ${mod.Model} module.  Specifically on the ${Links.Expiry}.   This combines basic support for CRUD as well as knowledge of how to manage expirable content.  Any model service that honors these contracts is a valid candidate to power the ${CacheService}.  The ${CacheService} is expecting the model service to be registered using the ${CacheModelⲐ.description!}:

${d.Code('Registering a Custom Model Source', 'doc/custom.ts')}
`;
/** @jsxImportSource @travetto/doc */
import { d, c, mod } from '@travetto/doc';

import { Links } from '@travetto/model/support/doc.support';

import { Cache, EvictCache } from './src/decorator';
import { CacheModelⲐ, CacheService } from './src/service';

export const text = <>
  <c.StdHeader />

  Provides a foundational structure for integrating caching at the method level.  This allows for easy extension with a variety of providers, and is usable with or without {d.mod('Di')}.  The code aims to handle use cases surrounding common/basic usage.<br />

  The cache module requires an {Links.Expiry} to provide functionality for reading and writing streams. You can use any existing providers to serve as your {Links.Expiry}, or you can roll your own.

  <c.Install title='provider' pkg='@travetto/model-{provider}' />

  Currently, the following are packages that provide {Links.Expiry}:
  <ul>
    <li>{d.mod('ModelDynamodb')} - {mod.ModelDynamodb.name}</li>
    <li>{d.mod('ModelElasticsearch')} - {mod.ModelElasticsearch.name}</li>
    <li>{d.mod('ModelMongo')} - {mod.ModelMongo.name}</li>
    <li>{d.mod('ModelRedis')} - {mod.ModelRedis.name}</li>
    <li>{d.mod('ModelS3')} - {mod.ModelS3.name}</li>
    <li>{d.mod('ModelPostgres')} - {mod.ModelPostgres.name}</li>
    <li>{d.mod('ModelMysql')} - {mod.ModelMysql.name}</li>
    <li>{d.mod('ModelSqlite')} - {mod.ModelSqlite.name}</li>
    <li>{d.mod('ModelMemory')} - {mod.ModelMemory.name}</li>
    <li>{d.mod('ModelFile')} - {mod.ModelFile.name}</li>
  </ul>

  <c.Section title='Decorators'>
    The caching framework provides method decorators that enables simple use cases.  One of the requirements to use the caching decorators is that the method arguments, and return values need to be serializable into {d.library('JSON')}.  Any other data types are not currently supported and would require either manual usage of the caching services directly, or specification of serialization/deserialization routines in the cache config.<br />

    Additionally, to use the decorators you will need to have a {CacheService} object accessible on the class instance. This can be dependency injected, or manually constructed. The decorators will detect the field at time of method execution, which decouples construction of your class from the cache construction.<br />

    {Cache} is a decorator that will cache all successful results, keyed by a computation based on the method arguments.  Given the desire for supporting remote caches (e.g. {d.library('Redis')}, {d.library('Memcached')}), only asynchronous methods are supported.

    <c.Code title='Using decorators to cache expensive async call' src='doc/async.ts' />

    <c.SubSection title='Cache'>
      The {Cache} decorator supports configurations on:

      <ul>
        <li>{d.input('name')} the field name of the current class which points to the desired cache source.</li>
        <li>{d.input('config')} the additional/optional config options, on a per invocation basis</li>
        <ul>
          <li>{d.input('keySpace')} the key space within the cache.  Defaults to class name plus method name.</li>
          <li>{d.input('key')} the function  will use the inputs to determine the cache key, defaults to all params {d.method('JSON.stringify')}ied</li>
          <li>{d.input('params')} the function used to determine the inputs for computing the cache key.  This is an easier place to start to define what parameters are important in ,caching. This defaults to all inputs.</li>
          <li>{d.input('maxAge')} the number of milliseconds will hold the value before considering the cache entry to be invalid.  By default values will live infinitely.</li>
          <li>{d.input('extendOnAccess')} determines if the cache timeout should be extended on access.  This only applies to cache values that have specified a {d.input('maxAge')}.</li>
          <li>{d.input('serialize')} the function to execute before storing a cacheable value.  This allows for any custom data modification needed to persist as a string properly.</li>
          <li>{d.input('reinstate')} the function to execute on return of a cached value.  This allows for any necessary operations to conform to expected output (e.g. re-establishing class instances, etc.).  This method should not be used often, as the return values of the methods should naturally serialize to/from {d.input('JSON')} and the values should be usable either way.</li>
        </ul>
      </ul>
    </c.SubSection>

    <c.SubSection title='EvictCache'>
      Additionally, there is support for planned eviction via the {EvictCache} decorator.  On successful execution of a method with this decorator, the matching keySpace/key value will be evicted from the cache.  This requires coordination between multiple methods, to use the same {d.input('keySpace')} and {d.input('key')} to compute the expected key.

      <c.Code title='Using decorators to cache/evict user access' src='doc/evict.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Extending the Cache Service'>

    By design, the {CacheService} relies solely on the {d.mod('Model')} module.  Specifically on the {Links.Expiry}.   This combines basic support for CRUD as well as knowledge of how to manage expirable content.  Any model service that honors these contracts is a valid candidate to power the {CacheService}.  The {CacheService} is expecting the model service to be registered using the {CacheModelⲐ.description!}:

    <c.Code title='Registering a Custom Model Source' src='doc/custom.ts' />
  </c.Section>
</>;
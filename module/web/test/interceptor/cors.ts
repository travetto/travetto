import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { CorsConfig, CorsInterceptor, HTTP_METHODS, WebRequest, WebResponse } from '@travetto/web';
import { RootRegistry } from '@travetto/registry';

@Suite()
class CorsInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {

    const interceptor = new CorsInterceptor();
    interceptor.config = CorsConfig.from({});
    interceptor.finalizeConfig(interceptor.config);

    const res = await interceptor.filter({
      req: new WebRequest(),
      next: async () => WebResponse.fromEmpty(),
      config: interceptor.config
    });

    assert(res.headers.has('Access-Control-Allow-Origin'));
    assert(res.headers.get('Access-Control-Allow-Origin') === '*');

    assert(res.headers.has('Access-Control-Allow-Methods'));
    assert.deepStrictEqual(
      res.headers.getList('Access-Control-Allow-Methods'),
      Object.keys(HTTP_METHODS)
    );

    assert(res.headers.has('Access-Control-Allow-Headers'));
    assert(res.headers.get('Access-Control-Allow-Headers') === '*');

    assert(res.headers.has('Access-Control-Allow-Credentials'));
    assert(res.headers.get('Access-Control-Allow-Credentials') === 'false');

    const res2 = await interceptor.filter({
      req: new WebRequest({
        headers: {
          'Access-Control-Request-Headers': ['ETag', 'BTag']
        }
      }),
      next: async () => WebResponse.fromEmpty(),
      config: interceptor.config
    });

    assert(res2.headers.has('Access-Control-Allow-Headers'));
    assert.deepStrictEqual(res2.headers.getList('Access-Control-Allow-Headers'), ['ETag', 'BTag']);
  }

  @Test()
  async customized() {

    const interceptor = new CorsInterceptor();
    interceptor.config = CorsConfig.from({
      methods: ['GET', 'PATCH'],
      origins: ['google.com', 'boogle.com'],
      headers: ['Content-Type', 'Accept'],
      credentials: true,
    });
    interceptor.finalizeConfig(interceptor.config);

    const res = await interceptor.filter({
      req: new WebRequest({
        headers: {
          Origin: 'google.com'
        }
      }),
      next: async () => WebResponse.fromEmpty(),
      config: interceptor.config
    });

    assert(res.headers.has('Access-Control-Allow-Origin'));
    assert.deepStrictEqual(res.headers.getList('Access-Control-Allow-Origin'), ['google.com']);

    assert(res.headers.has('Access-Control-Allow-Methods'));
    assert.deepStrictEqual(
      res.headers.getList('Access-Control-Allow-Methods'),
      ['GET', 'PATCH']
    );

    assert(res.headers.has('Access-Control-Allow-Headers'));
    assert.deepStrictEqual(res.headers.getList('Access-Control-Allow-Headers'), ['Content-Type', 'Accept']);

    assert(res.headers.has('Access-Control-Allow-Credentials'));
    assert(res.headers.get('Access-Control-Allow-Credentials') === 'true');
  }

  @Test()
  async unsupportedOrigin() {

    const interceptor = new CorsInterceptor();
    interceptor.config = CorsConfig.from({
      methods: ['GET', 'PATCH'],
      origins: ['google.com', 'boogle.com'],
      headers: ['Content-Type', 'Accept'],
      credentials: true,
    });
    interceptor.finalizeConfig(interceptor.config);

    const res = await interceptor.filter({
      req: new WebRequest({
        headers: {
          Origin: 'google2.com'
        }
      }),
      next: async () => WebResponse.fromEmpty(),
      config: interceptor.config
    });

    assert(!res.headers.has('Access-Control-Allow-Origin'));
    assert(!res.headers.has('Access-Control-Allow-Methods'));
    assert(!res.headers.has('Access-Control-Allow-Headers'));
    assert(!res.headers.has('Access-Control-Allow-Credentials'));
  }
}
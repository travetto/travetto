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

    const response = await interceptor.filter({
      request: new WebRequest(),
      next: async () => new WebResponse(),
      config: interceptor.config
    });

    assert(response.headers.has('Access-Control-Allow-Origin'));
    assert(response.headers.get('Access-Control-Allow-Origin') === '*');

    assert(response.headers.has('Access-Control-Allow-Methods'));
    assert.deepStrictEqual(
      response.headers.getList('Access-Control-Allow-Methods'),
      Object.keys(HTTP_METHODS)
    );

    assert(response.headers.has('Access-Control-Allow-Headers'));
    assert(response.headers.get('Access-Control-Allow-Headers') === '*');

    assert(response.headers.has('Access-Control-Allow-Credentials'));
    assert(response.headers.get('Access-Control-Allow-Credentials') === 'false');

    const res2 = await interceptor.filter({
      request: new WebRequest({
        headers: {
          'Access-Control-Request-Headers': ['ETag', 'BTag']
        }
      }),
      next: async () => new WebResponse(),
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

    const response = await interceptor.filter({
      request: new WebRequest({
        headers: {
          Origin: 'google.com'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    });

    assert(response.headers.has('Access-Control-Allow-Origin'));
    assert.deepStrictEqual(response.headers.getList('Access-Control-Allow-Origin'), ['google.com']);

    assert(response.headers.has('Access-Control-Allow-Methods'));
    assert.deepStrictEqual(
      response.headers.getList('Access-Control-Allow-Methods'),
      ['GET', 'PATCH']
    );

    assert(response.headers.has('Access-Control-Allow-Headers'));
    assert.deepStrictEqual(response.headers.getList('Access-Control-Allow-Headers'), ['Content-Type', 'Accept']);

    assert(response.headers.has('Access-Control-Allow-Credentials'));
    assert(response.headers.get('Access-Control-Allow-Credentials') === 'true');
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

    const response = await interceptor.filter({
      request: new WebRequest({
        headers: {
          Origin: 'google2.com'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    });

    assert(!response.headers.has('Access-Control-Allow-Origin'));
    assert(!response.headers.has('Access-Control-Allow-Methods'));
    assert(!response.headers.has('Access-Control-Allow-Headers'));
    assert(!response.headers.has('Access-Control-Allow-Credentials'));
  }
}
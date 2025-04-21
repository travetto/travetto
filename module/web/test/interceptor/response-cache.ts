import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { ResponseCacheConfig, ResponseCacheInterceptor, WebRequest, WebResponse } from '@travetto/web';

@Suite()
class ResponseCacheInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {
    const interceptor = new ResponseCacheInterceptor();
    interceptor.config = ResponseCacheConfig.from({ mode: 'deny' });

    const res = await interceptor.filter({
      request: new WebRequest({ context: { path: '/', httpMethod: 'GET' } }),
      next: async () => new WebResponse(),
      config: interceptor.config
    });

    assert(res.headers.has('Cache-Control'));
    assert(/no-cache/.test(res.headers.get('Cache-Control')!));

    const res2 = await interceptor.filter({
      request: new WebRequest({ context: { path: '/', httpMethod: 'PATCH' } }),
      next: async () => new WebResponse(),
      config: interceptor.config
    });

    assert(!res2.headers.has('Cache-Control'));
  }

  @Test()
  async overridden() {
    const interceptor = new ResponseCacheInterceptor();
    interceptor.config = ResponseCacheConfig.from({ mode: 'allow' });

    const res = await interceptor.filter({
      request: new WebRequest({ context: { path: '/', httpMethod: 'GET' } }),
      next: async () => new WebResponse({ headers: { 'cache-control': 'max-age=3000' } }),
      config: interceptor.config
    });

    assert(res.headers.has('Cache-Control'));
    assert(res.headers.get('Cache-Control') === 'max-age=3000');
  }
}
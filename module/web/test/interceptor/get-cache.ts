import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { GetCacheConfig, GetCacheInterceptor, WebRequest, WebResponse } from '@travetto/web';

@Suite()
class GetCacheInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {
    const interceptor = new GetCacheInterceptor();
    interceptor.config = GetCacheConfig.from({});

    const res = await interceptor.filter({
      req: new WebRequest({ method: 'GET' }),
      next: async () => new WebResponse({}),
      config: interceptor.config
    });

    assert(res.headers.has('Cache-Control'));
    assert(/no-cache/.test(res.headers.get('Cache-Control')!));

    const res2 = await interceptor.filter({
      req: new WebRequest({ method: 'PATCH' }),
      next: async () => new WebResponse({}),
      config: interceptor.config
    });

    assert(!res2.headers.has('Cache-Control'));
  }

  @Test()
  async overridden() {
    const interceptor = new GetCacheInterceptor();
    interceptor.config = GetCacheConfig.from({});

    const res = await interceptor.filter({
      req: new WebRequest({ method: 'GET' }),
      next: async () => new WebResponse({ headers: { 'cache-control': 'max-age=3000' } }),
      config: interceptor.config
    });

    assert(res.headers.has('Cache-Control'));
    assert(res.headers.get('Cache-Control') === 'max-age=3000');
  }
}
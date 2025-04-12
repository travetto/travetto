import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { AsyncContextInterceptor, WebRequest, WebResponse, WebAsyncContext } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';

@Suite()
class AsyncContextInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {
    const interceptor = await DependencyRegistry.getInstance(AsyncContextInterceptor);

    const req = new WebRequest({ method: 'GET' });
    const res = await interceptor.filter({
      req,
      next: async () => {
        const ctx = await DependencyRegistry.getInstance(WebAsyncContext);
        req.headers.set('Modified', '1');
        return WebResponse.from(ctx.req === req); // We have the same instance
      },
      config: {}
    });

    assert(res.body === true);
    assert(req.headers.get('Modified') === '1');
  }
}
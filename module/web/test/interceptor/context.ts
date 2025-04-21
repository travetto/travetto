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

    const request = new WebRequest({ context: { path: '/', httpMethod: 'GET' } });
    const response = await interceptor.filter({
      request,
      next: async () => {
        const ctx = await DependencyRegistry.getInstance(WebAsyncContext);
        request.headers.set('Modified', '1');
        return new WebResponse({ body: ctx.request === request }); // We have the same instance
      },
      config: {}
    });

    assert(response.body === true);
    assert(request.headers.get('Modified') === '1');
  }
}
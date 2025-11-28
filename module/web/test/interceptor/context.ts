import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { AsyncContextInterceptor, WebRequest, WebResponse, WebAsyncContext } from '@travetto/web';
import { DependencyRegistryIndex } from '@travetto/di';

@Suite()
class AsyncContextInterceptorSuite {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async basicTest() {
    const interceptor = await DependencyRegistryIndex.getInstance(AsyncContextInterceptor);

    const request = new WebRequest({ context: { path: '/', httpMethod: 'GET' } });
    const response = await interceptor.filter({
      request,
      next: async () => {
        const ctx = await DependencyRegistryIndex.getInstance(WebAsyncContext);
        request.headers.set('Modified', '1');
        return new WebResponse({ body: ctx.request === request }); // We have the same instance
      },
      config: {}
    });

    assert(response.body === true);
    assert(request.headers.get('Modified') === '1');
  }
}
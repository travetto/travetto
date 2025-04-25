import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { CookiesInterceptor, WebAsyncContext, WebRequest, WebResponse } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { AsyncContext } from '@travetto/context';

@Suite()
class CookiesInterceptorSuite {
  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {
    const interceptor = await DependencyRegistry.getInstance(CookiesInterceptor);
    const context = await DependencyRegistry.getInstance(AsyncContext);
    const response = await context.run(async () => interceptor.filter({
      request: new WebRequest({
        headers: {
          Cookie: 'age=100'
        }
      }),
      config: interceptor.config,
      next: async () => {
        const items = await DependencyRegistry.getInstance(WebAsyncContext);
        items.cookies.set({
          name: 'valid',
          value: (items.cookies.get('age') === '100').toString()
        });
        return new WebResponse({});
      }
    }));

    assert(response.headers.has('Set-Cookie'));
    assert(response.headers.getSetCookie().find(x => x === 'valid=true') !== undefined);
  }
}
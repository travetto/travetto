import assert from 'node:assert';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Keygrip from 'keygrip';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { Cookie, CookieJar, CookiesInterceptor, WebAsyncContext, WebRequest, WebResponse } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { AsyncContext } from '@travetto/context';

@Suite()
class CookiesInterceptorSuite {
  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  async testCookies(
    initial: { name: string, value: string, signingKey?: string }[],
    update: (cookies: CookieJar) => void,
  ): Promise<Cookie[]> {
    const interceptor = await DependencyRegistry.getInstance(CookiesInterceptor);
    const context = await DependencyRegistry.getInstance(AsyncContext);

    const inbound: string[] = [];
    for (const item of initial) {
      const cookieJar = new CookieJar([item], item.signingKey ? { grip: new Keygrip([item.signingKey]) } : {});
      inbound.push(...cookieJar.export(false));
    }

    const response = await context.run(async () => interceptor.filter({
      request: new WebRequest({
        headers: {
          Cookie: inbound.join(',')
        }
      }),
      config: interceptor.config,
      next: async () => {
        const items = await DependencyRegistry.getInstance(WebAsyncContext);
        await update?.(items.cookies);
        return new WebResponse({});
      }
    }));
    return new CookieJar(response.headers.getSetCookie().join('; ')).raw();
  }

  @Test()
  async basicTest() {
    const cookies = await this.testCookies(
      [{
        name: 'age',
        value: '100'
      }],
      jar => {
        jar.set({ name: 'valid', value: (jar.get('age') === '100').toString() });
      }
    );

    assert(cookies.length === 1);
    assert(cookies[0].name === 'valid');
    assert(cookies[0].value === 'true');
  }
}
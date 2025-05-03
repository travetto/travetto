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
    keyOrder?: string[]
  ): Promise<Cookie[]> {
    const interceptor = await DependencyRegistry.getInstance(CookiesInterceptor);
    const context = await DependencyRegistry.getInstance(AsyncContext);

    const keys = initial.map(x => x.signingKey).filter((x): x is string => !!x);
    interceptor.config.keys = keyOrder ?? keys;
    interceptor.config.secure = true;

    const cookieJar = new CookieJar([], interceptor.config);

    for (const item of initial) {
      if (item.signingKey) {
        const local = new Keygrip([item.signingKey!]);
        cookieJar.set({ ...item, signed: false });
        cookieJar.set({ name: `${item.name}.sig`, value: local.sign(`${item.name}=${item.value}`), signed: false });
      } else {
        cookieJar.set(item);
      }
    }

    const response = await context.run(async () => interceptor.filter({
      request: new WebRequest({
        headers: {
          Cookie: cookieJar.export(false).join(',')
        }
      }),
      config: interceptor.config,
      next: async () => {
        const items = await DependencyRegistry.getInstance(WebAsyncContext);
        await update?.(items.getValue(CookieJar));
        return new WebResponse({});
      }
    }));
    return new CookieJar(response.headers.getSetCookie()).getAll();
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


  @Test()
  async testSigned() {
    const cookies = await this.testCookies(
      [{
        name: 'age',
        value: '100',
        signingKey: 'billy'
      }],
      jar => {
        jar.set({
          name: 'valid',
          value: (!!jar.get('age', { signed: true })).toString()
        });
      }
    );

    assert(cookies.length === 2);
    assert(cookies[0].name === 'valid');
    assert(cookies[1].name === 'valid.sig');
    assert(cookies[0].value === 'true');
  }

  @Test()
  async testRotating() {
    const cookies = await this.testCookies(
      [{
        name: 'age',
        value: '100',
        signingKey: 'billy'
      }],
      jar => { },
      ['bally', 'billy']
    );

    assert(cookies.length === 1);
    assert(cookies[0].name === 'age.sig');
    assert(cookies[0].secure);
    assert(cookies[0].value === new Keygrip(['bally']).sign('age=100'));
  }

  @Test()
  async testInvalidSigned() {
    const cookies = await this.testCookies(
      [{
        name: 'age',
        value: '100',
        signingKey: 'billy'
      }],
      jar => {
        jar.set({
          name: 'valid',
          value: (!!jar.get('age', { signed: true })).toString()
        });
        jar.set({
          name: 'invalid',
          value: (!!jar.get('age', { signed: false })).toString()
        });
      },
      ['bally]']
    );

    assert(cookies.length === 4);
    assert(cookies[0].name === 'valid');
    assert(cookies[1].name === 'valid.sig');
    assert(cookies[0].value === 'false');

    assert(cookies[2].name === 'invalid');
    assert(cookies[3].name === 'invalid.sig');
    assert(cookies[2].value === 'true');
  }
}
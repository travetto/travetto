import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { CookieJar, CookieInterceptor, WebAsyncContext, WebRequest, WebResponse, KeyGrip, type WebHeaders, type Cookie } from '@travetto/web';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { AsyncContext } from '@travetto/context';

@Suite()
class CookiesInterceptorSuite {
  @BeforeAll()
  async init() {
    await Registry.init();
  }

  async getCookies(keys: string[] | undefined, headers: string[]): Promise<Cookie[]> {
    const jar = new CookieJar({}, keys);
    await jar.importSetCookieHeader(headers);
    return jar.getAll();
  }

  async testCookies(
    initialCookieHeader: string,
    update: (cookies: CookieJar) => void,
    grip?: KeyGrip | undefined
  ): Promise<string[]> {
    const interceptor = await DependencyRegistryIndex.getInstance(CookieInterceptor);
    const context = await DependencyRegistryIndex.getInstance(AsyncContext);

    interceptor.keyGrip = grip ?? new KeyGrip([]);
    interceptor.config.secure = true;

    const response = await context.run(async () => interceptor.filter({
      request: new WebRequest({
        headers: {
          Cookie: initialCookieHeader
        }
      }),
      config: interceptor.config,
      next: async () => {
        const items = await DependencyRegistryIndex.getInstance(WebAsyncContext);
        update?.(items.getValue(CookieJar));
        return new WebResponse({});
      }
    }));
    return response.headers.getSetCookie();
  }

  @Test()
  async basicTest() {
    const headers = await this.testCookies(
      'age=100',
      jar => {
        jar.set({ name: 'valid', value: (jar.get('age') === '100').toString() });
      }
    );

    const cookies = await this.getCookies(undefined, headers);

    assert(cookies.length === 1);
    assert(cookies[0].name === 'valid');
    assert(cookies[0].value === 'true');
  }

  @Test()
  async testSigned() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${await grip.sign('age=100')}`,
      jar => {
        jar.set({
          name: 'valid',
          value: (!!jar.get('age', { signed: true })).toString()
        });
      },
      grip
    );

    const cookies = await this.getCookies(['billy'], headers);

    assert(cookies.length === 1);
    assert(cookies[0].name === 'valid');
    assert(cookies[0].signed);
    assert(cookies[0].value === 'true');
  }

  @Test()
  async testRotating() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${await grip.sign('age=100')}`,
      jar => { },
      new KeyGrip(['bally', 'billy'])
    );

    const cookies = await this.getCookies(['bally'], headers);

    assert(cookies.length === 1);
    assert(cookies[0].name === 'age');
    assert(cookies[0].signed);
    assert(cookies[0].value === '100');
  }

  @Test()
  async testInvalidSigned() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${await grip.sign('age=100')}`,
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
      new KeyGrip(['bally'])
    );

    const cookies = await this.getCookies(['bally'], headers);

    assert(cookies.length === 2);

    assert(cookies[0].name === 'valid');
    assert(cookies[0].value === 'false');

    assert(cookies[1].name === 'invalid');
    assert(cookies[1].value === 'false');
  }
}
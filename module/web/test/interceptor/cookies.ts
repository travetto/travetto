import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { CookieJar, CookieInterceptor, WebAsyncContext, WebRequest, WebResponse, KeyGrip } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';
import { RegistryV2 } from '@travetto/registry';
import { AsyncContext } from '@travetto/context';

@Suite()
class CookiesInterceptorSuite {
  @BeforeAll()
  async init() {
    await RegistryV2.init();
  }

  async testCookies(
    initialCookieHeader: string,
    update: (cookies: CookieJar) => void,
    signingKeys?: string[]
  ): Promise<string[]> {
    const interceptor = await DependencyRegistry.getInstance(CookieInterceptor);
    const context = await DependencyRegistry.getInstance(AsyncContext);

    interceptor.config.keys = signingKeys;
    interceptor.config.secure = true;
    interceptor.config.signed = !!signingKeys?.length;

    const response = await context.run(async () => interceptor.filter({
      request: new WebRequest({
        headers: {
          Cookie: initialCookieHeader
        }
      }),
      config: interceptor.config,
      next: async () => {
        const items = await DependencyRegistry.getInstance(WebAsyncContext);
        await update?.(items.getValue(CookieJar));
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

    const cookies = new CookieJar().importSetCookieHeader(headers).getAll();

    assert(cookies.length === 1);
    assert(cookies[0].name === 'valid');
    assert(cookies[0].value === 'true');
  }


  @Test()
  async testSigned() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${grip.sign('age=100')}`,
      jar => {
        jar.set({
          name: 'valid',
          value: (!!jar.get('age', { signed: true })).toString()
        });
      },
      ['billy']
    );

    const cookies = new CookieJar({ keys: ['billy'] }).importSetCookieHeader(headers).getAll();

    assert(cookies.length === 1);
    assert(cookies[0].name === 'valid');
    assert(cookies[0].signed);
    assert(cookies[0].value === 'true');
  }

  @Test()
  async testRotating() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${grip.sign('age=100')}`,
      jar => { },
      ['bally', 'billy']
    );

    const cookies = new CookieJar({ keys: ['bally'] }).importSetCookieHeader(headers).getAll();

    assert(cookies.length === 1);
    assert(cookies[0].name === 'age');
    assert(cookies[0].signed);
    assert(cookies[0].value === '100');
  }

  @Test()
  async testInvalidSigned() {
    const grip = new KeyGrip(['billy']);
    const headers = await this.testCookies(
      `age=100; age.sig=${grip.sign('age=100')}`,
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
      ['bally']
    );

    const cookies = new CookieJar({ keys: ['bally'] }).importSetCookieHeader(headers).getAll();

    assert(cookies.length === 2);

    assert(cookies[0].name === 'valid');
    assert(cookies[0].value === 'false');

    assert(cookies[1].name === 'invalid');
    assert(cookies[1].value === 'false');
  }
}
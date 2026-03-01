import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CookieJar } from '@travetto/web';

@Suite()
class CookieJarSuite {
  @Test()
  async simpleTest() {
    const jar = new CookieJar();
    await jar.importCookieHeader(
      'age=  20, gonzo; height=30; auth=10000000xx; borange!!!'
    );

    assert(jar.get('age') === '20, gonzo');
    assert(jar.get('height') === '30');
    assert(jar.get('auth') === '10000000xx');
    assert(jar.has('borange!!!'));
  }

  @Test()
  async simpleSignTest() {
    const jar = new CookieJar({}, ['test']);
    jar.set({ name: 'test', value: 'green' });

    assert(jar.has('test'));
    assert(!jar.has('test.sig'));

    const reload = new CookieJar({}, ['test']);
    await reload.import(jar.getAll());

    assert(reload.has('test'));
    assert(!reload.has('test.sig'));

    const output = await jar.exportSetCookieHeader();
    assert(output.find(x => x.includes('test.sig')));
  }

  @Test()
  async simplSignMismatch() {
    const jar = new CookieJar({}, ['test']);
    jar.set({ name: 'test', value: 'green' });
    jar.set({ name: 'test2', value: 'green', signed: false });

    assert(!jar.has('test', { signed: false }));
    assert(jar.has('test', { signed: true }));
    assert(jar.has('test'));

    assert(jar.has('test2', { signed: false }));
    assert(!jar.has('test2', { signed: true }));
    assert(!jar.has('test2'));

    const unsigned = new CookieJar();
    unsigned.set({ name: 'test', value: 'green' });
    assert(unsigned.has('test', { signed: false }));
    assert(unsigned.has('test'));
    assert(!unsigned.has('test', { signed: true }));
  }

  @Test()
  async signWithoutKeys() {
    const jar = new CookieJar();
    assert.throws(() => {
      jar.set({ name: 'test', value: 'green', signed: true });
    }, /Signing keys required/i);
  }
}
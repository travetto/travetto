import assert from 'node:assert';

import { Test, Suite, BeforeAll } from '@travetto/test';

import { BaseWebSuite } from './base.ts';
import { TestController } from './controller.ts';
import { ControllerRegistry } from '../../src/registry/controller.ts';

@Suite()
export abstract class WebServerSuite extends BaseWebSuite {

  @BeforeAll()
  async init() {
    ControllerRegistry.register(TestController);
    await ControllerRegistry.install(TestController, { type: 'added' });
  }

  @Test()
  async getJSON() {
    const { body: ret } = await this.request('GET', '/test/json');
    assert.deepStrictEqual(ret, { json: true });
  }

  @Test()
  async getParam() {
    const { body: ret } = await this.request('POST', '/test/param/bob');
    assert.deepStrictEqual(ret, { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const { body: ret } = await this.request('PUT', '/test/query', {
      query: {
        age: '20'
      }
    });
    assert.deepStrictEqual(ret, { query: 20 });

    await assert.rejects(() => this.request('PUT', '/test/query', {
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async postBody() {
    const { body: ret } = await this.request('PUT', '/test/body', {
      body: {
        age: 20
      }
    });
    assert.deepStrictEqual(ret, { body: 20 });
  }

  @Test()
  async testCookie() {
    const { body: ret, headers } = await this.request('DELETE', '/test/cookie', {
      headers: {
        Cookie: 'orange=yummy'
      }
    });
    const [cookie] = headers.getSetCookie();
    assert(cookie !== undefined);
    assert(/flavor.*oreo/.test(cookie));
    assert.deepStrictEqual(ret, { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const { body: ret, headers } = await this.request('PATCH', '/test/regexp/super-poodle-party');
    assert.deepStrictEqual(ret, { path: 'poodle' });
    assert(headers.has('ETag'));
  }

  @Test()
  async testBuffer() {
    const { body: ret, headers } = await this.request('GET', '/test/buffer');
    assert(ret === 'hello');
    assert(headers.has('ETag'));
  }

  @Test()
  async testStream() {
    try {
      const { body: ret, headers } = await this.request('GET', '/test/stream');
      assert(ret === 'hello');
      assert(!headers.has('ETag'));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const { body: ret } = await this.request('GET', '/test/renderable');
    assert(ret === 'hello');
  }

  @Test()
  async testFullUrl() {
    const { body: ret } = await this.request('GET', '/test/fullUrl');
    assert.deepStrictEqual(ret, { path: '/test/fullUrl' });
  }

  @Test()
  async testHeaderFirst() {
    const { body: ret } = await this.request('GET', '/test/headerFirst', {
      headers: {
        age: ['1', '2', '3']
      }
    });
    assert.deepStrictEqual(ret, { header: '1' });
  }

  @Test()
  async testGetIp() {
    const { body: ret } = await this.request<{ ip: string | undefined }>('GET', '/test/ip');
    assert(ret.ip === '127.0.0.1' || ret.ip === '::1');

    const { body: ret2 } = await this.request<{ ip: string | undefined }>('GET', '/test/ip', { headers: { 'X-Forwarded-For': 'bob' } });
    assert(ret2.ip === 'bob');
  }

  @Test()
  async testErrorThrow() {
    const { status } = await this.request<{ ip: string | undefined }>('POST', '/test/ip', { throwOnError: false });
    assert(status === 500);
  }

  @Test()
  async compressionReturned() {
    {
      const { body: ret, headers } = await this.request('GET', '/test/json', { headers: { 'Accept-Encoding': 'gzip;q=1' } });
      assert(!headers.has('Content-Encoding'));
      assert.deepStrictEqual(ret, { json: true });
    }
    for (const encoding of ['gzip', 'br', 'deflate']) {
      const { body: ret, headers } = await this.request('GET', '/test/json/large/20000', { headers: { 'Accept-Encoding': `${encoding};q=1` } });
      const value = headers.get('Content-Encoding');
      assert(value === encoding);

      assert(ret && typeof ret === 'object');
      assert('json' in ret);
      assert(typeof ret.json === 'string');
      assert(ret.json.startsWith('0123456789'));
    }

    {
      const { headers } = await this.request('GET', '/test/json/large/50000', { headers: { 'Accept-Encoding': 'orange' }, throwOnError: false });
      assert(!('content-encoding' in headers));
      // assert(status === 406);
    }
  }

  @Test()
  async testWildcard() {
    const { body: ret } = await this.request<{ path: string }>('GET', '/test/fun/1/2/3/4');
    assert(ret.path === '1/2/3/4');
  }
}
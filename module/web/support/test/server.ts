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
    const { source: ret } = await this.request({ method: 'GET', path: '/test/json' });
    assert.deepStrictEqual(ret, { json: true });
  }

  @Test()
  async getParam() {
    const { source: ret } = await this.request({ method: 'POST', path: '/test/param/bob' });
    assert.deepStrictEqual(ret, { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const { source: ret } = await this.request({
      method: 'PUT', path: '/test/query',
      query: {
        age: '20'
      }
    });
    assert.deepStrictEqual(ret, { query: 20 });

    await assert.rejects(() => this.request({
      method: 'PUT', path: '/test/query',
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async postBody() {
    const { source: ret } = await this.request({
      method: 'PUT', path: '/test/body',
      body: {
        age: 20
      }
    });
    assert.deepStrictEqual(ret, { source: 20 });
  }

  @Test()
  async testCookie() {
    const { source: ret, headers } = await this.request({
      method: 'DELETE', path: '/test/cookie',
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
    const { source: ret, headers } = await this.request({ method: 'PATCH', path: '/test/regexp/super-poodle-party' });
    assert.deepStrictEqual(ret, { path: 'poodle' });
    assert(headers.has('ETag'));
  }

  @Test()
  async testBuffer() {
    const { source: ret, headers } = await this.request({ method: 'GET', path: '/test/buffer' });
    assert(ret === 'hello');
    assert(headers.has('ETag'));
  }

  @Test()
  async testStream() {
    try {
      const { source: ret, headers } = await this.request({ method: 'GET', path: '/test/stream' });
      assert(ret === 'hello');
      assert(!headers.has('ETag'));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const { source: ret } = await this.request({ method: 'GET', path: '/test/renderable' });
    assert(ret === 'hello');
  }

  @Test()
  async testFullUrl() {
    const { source: ret } = await this.request({ method: 'GET', path: '/test/fullUrl' });
    assert.deepStrictEqual(ret, { path: '/test/fullUrl' });
  }

  @Test()
  async testHeaderFirst() {
    const { source: ret } = await this.request({
      method: 'GET', path: '/test/headerFirst',
      headers: {
        age: ['1', '2', '3']
      }
    });
    assert.deepStrictEqual(ret, { header: '1' });
  }

  @Test()
  async testGetIp() {
    const { source: ret } = await this.request<{ ip: string | undefined }>({ method: 'GET', path: '/test/ip' });
    assert(ret?.ip === '127.0.0.1' || ret?.ip === '::1');

    const { source: ret2 } = await this.request<{ ip: string | undefined }>({ method: 'GET', path: '/test/ip', headers: { 'X-Forwarded-For': 'bob' } });
    assert(ret2?.ip === 'bob');
  }

  @Test()
  async testErrorThrow() {
    const { statusCode } = await this.request<{ ip: string | undefined }>({ method: 'POST', path: '/test/ip' }, false);
    assert(statusCode === 500);
  }

  @Test()
  async compressionReturned() {
    {
      const { source: ret, headers } = await this.request({ method: 'GET', path: '/test/json', headers: { 'Accept-Encoding': 'gzip;q=1' } });
      assert(!headers.has('Content-Encoding'));
      assert.deepStrictEqual(ret, { json: true });
    }
    for (const encoding of ['gzip', 'br', 'deflate']) {
      const { source: ret, headers } = await this.request({ method: 'GET', path: '/test/json/large/20000', headers: { 'Accept-Encoding': `${encoding};q=1` } });
      const value = headers.get('Content-Encoding');
      assert(value === encoding);

      assert(ret && typeof ret === 'object');
      assert('json' in ret);
      assert(typeof ret.json === 'string');
      assert(ret.json.startsWith('0123456789'));
    }

    {
      const { headers } = await this.request({ method: 'GET', path: '/test/json/large/50000', headers: { 'Accept-Encoding': 'orange' } }, false);
      assert(!('content-encoding' in headers));
      // assert(status === 406);
    }
  }

  @Test()
  async testWildcard() {
    const { source: ret } = await this.request<{ path: string }>({ method: 'GET', path: '/test/fun/1/2/3/4' });
    assert(ret?.path === '1/2/3/4');
  }
}
import assert from 'node:assert';

import { Test, Suite, BeforeAll } from '@travetto/test';

import { BaseWebSuite } from './base.ts';
import { TestController } from './controller.ts';
import { ControllerRegistry } from '../../../src/registry/controller.ts';

@Suite()
export abstract class StandardWebServerSuite extends BaseWebSuite {

  @BeforeAll()
  async init() {
    ControllerRegistry.register(TestController);
    await ControllerRegistry.install(TestController, { type: 'added' });
  }

  @Test()
  async getJSON() {
    const res = await this.request({ method: 'GET', path: '/test/json' });
    assert.deepStrictEqual(res.body, { json: true });
  }

  @Test()
  async getParam() {
    const res = await this.request({ method: 'POST', path: '/test/param/bob' });
    assert.deepStrictEqual(res.body, { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const res = await this.request({
      method: 'PUT', path: '/test/query',
      query: {
        age: '20'
      }
    });
    assert.deepStrictEqual(res.body, { query: 20 });

    await assert.rejects(() => this.request({
      method: 'PUT', path: '/test/query',
      query: {
        age: 'blue'
      }
    }), /Validation errors have occurred/i);
  }

  @Test()
  async postBody() {
    const res = await this.request({
      method: 'PUT', path: '/test/body',
      body: {
        age: 20
      }
    });
    assert.deepStrictEqual(res.body, { body: 20 });
  }

  @Test()
  async testCookie() {
    const res = await this.request({
      method: 'DELETE', path: '/test/cookie',
      headers: {
        Cookie: 'orange=yummy'
      }
    });
    const [cookie] = res.headers.getSetCookie();
    assert(cookie !== undefined);
    assert(/flavor.*oreo/.test(cookie));
    assert.deepStrictEqual(res.body, { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const res = await this.request({ method: 'PATCH', path: '/test/regexp/super-poodle-party' });
    assert.deepStrictEqual(res.body, { path: 'poodle' });
    assert(res.headers.has('ETag'));
  }

  @Test()
  async testBuffer() {
    const res = await this.request({ method: 'GET', path: '/test/buffer' });
    assert(res.body === 'hello');
    assert(res.headers.has('ETag'));
  }

  @Test()
  async testStream() {
    try {
      const res = await this.request({ method: 'GET', path: '/test/stream' });
      assert(res.body === 'hello');
      assert(!res.headers.has('ETag'));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const res = await this.request({ method: 'GET', path: '/test/renderable' });
    assert(res.body === 'hello');
  }

  @Test()
  async testFullUrl() {
    const res = await this.request({ method: 'GET', path: '/test/fullUrl' });
    assert.deepStrictEqual(res.body, { path: '/test/fullUrl' });
  }

  @Test()
  async testHeaderFirst() {
    const res = await this.request({
      method: 'GET', path: '/test/headerFirst',
      headers: {
        age: ['1', '2', '3']
      }
    });
    assert.deepStrictEqual(res.body, { header: '1' });
  }

  @Test()
  async testGetIp() {
    const res = await this.request<{ ip: string | undefined }>({ method: 'GET', path: '/test/ip', connection: { ip: '::1' } });
    assert(res.body?.ip === '127.0.0.1' || res.body?.ip === '::1');

    const { body: ret2 } = await this.request<{ ip: string | undefined }>({ method: 'GET', path: '/test/ip', headers: { 'X-Forwarded-For': 'bob' } });
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
      const res = await this.request({ method: 'GET', path: '/test/json', headers: { 'Accept-Encoding': 'gzip;q=1' } });
      assert(!res.headers.has('Content-Encoding'));
      assert.deepStrictEqual(res.body, { json: true });
    }
    for (const encoding of ['gzip', 'br', 'deflate']) {
      const res = await this.request({ method: 'GET', path: '/test/json/large/20000', headers: { 'Accept-Encoding': `${encoding};q=1` } });
      const value = res.headers.get('Content-Encoding');
      assert(value === encoding);

      assert(res.body);
      assert(typeof res.body === 'object');
      assert('json' in res.body);
      assert(typeof res.body.json === 'string');
      assert(res.body.json.startsWith('0123456789'));
    }

    {
      const { headers } = await this.request({ method: 'GET', path: '/test/json/large/50000', headers: { 'Accept-Encoding': 'orange' } }, false);
      assert(!('content-encoding' in headers));
      // assert(status === 406);
    }
  }

  @Test()
  async testWildcard() {
    const res = await this.request<{ path: string }>({ method: 'GET', path: '/test/fun/1/2/3/4' });
    assert(res.body?.path === '1/2/3/4');
  }
}
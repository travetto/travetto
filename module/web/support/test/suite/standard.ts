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
    const response = await this.request({ context: { httpMethod: 'GET', path: '/test/json' } });
    assert.deepStrictEqual(response.body, { json: true });
  }

  @Test()
  async getParam() {
    const response = await this.request({ context: { httpMethod: 'POST', path: '/test/param/bob' } });
    assert.deepStrictEqual(response.body, { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const response = await this.request({
      context: {
        httpMethod: 'PUT', path: '/test/query',
        httpQuery: {
          age: '20'
        }
      }
    });
    assert.deepStrictEqual(response.body, { query: 20 });

    await assert.rejects(() => this.request({
      context: {
        httpMethod: 'PUT', path: '/test/query',
        httpQuery: {
          age: 'blue'
        }
      }
    }), /Validation errors have occurred/i);
  }

  @Test()
  async postBody() {
    const response = await this.request({
      context: {
        httpMethod: 'PUT', path: '/test/body',
      },
      body: {
        age: 20
      }
    });
    assert.deepStrictEqual(response.body, { body: 20 });
  }

  @Test()
  async testCookie() {
    const response = await this.request({
      context: {
        httpMethod: 'DELETE', path: '/test/cookie',
      },
      headers: {
        Cookie: 'orange=yummy'
      }
    });
    const [cookie] = response.headers.getSetCookie();
    assert(cookie !== undefined);
    assert(/flavor.*oreo/.test(cookie));
    assert.deepStrictEqual(response.body, { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const response = await this.request({ context: { httpMethod: 'PATCH', path: '/test/regexp/super-poodle-party' } });
    assert.deepStrictEqual(response.body, { path: 'poodle' });
    assert(response.headers.has('ETag'));
  }

  @Test()
  async testBuffer() {
    const response = await this.request({ context: { httpMethod: 'GET', path: '/test/buffer' } });
    assert(response.body === 'hello');
    assert(response.headers.has('ETag'));
  }

  @Test()
  async testStream() {
    try {
      const response = await this.request({ context: { httpMethod: 'GET', path: '/test/stream' } });
      assert(response.body === 'hello');
      assert(!response.headers.has('ETag'));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const response = await this.request({ context: { httpMethod: 'GET', path: '/test/renderable' } });
    assert(response.body === 'hello');
  }

  @Test()
  async testFullUrl() {
    const response = await this.request({ context: { httpMethod: 'GET', path: '/test/fullUrl' } });
    assert.deepStrictEqual(response.body, { path: '/test/fullUrl' });
  }

  @Test()
  async testHeaderFirst() {
    const response = await this.request({
      context: {
        httpMethod: 'GET', path: '/test/headerFirst',
      },
      headers: {
        age: ['1', '2', '3']
      }
    });
    assert.deepStrictEqual(response.body, { header: '1' });
  }

  @Test()
  async testGetIp() {
    const response = await this.request<{ ip: string | undefined }>({ context: { httpMethod: 'GET', path: '/test/ip', connection: { ip: '::1' } } });
    assert(response.body?.ip === '127.0.0.1' || response.body?.ip === '::1');

    const { body: ret2 } = await this.request<{ ip: string | undefined }>({ context: { httpMethod: 'GET', path: '/test/ip' }, headers: { 'X-Forwarded-For': 'bob' } });
    assert(ret2?.ip === 'bob');
  }

  @Test()
  async testErrorThrow() {
    const { context: { httpStatusCode: statusCode } } = await this.request<{ ip: string | undefined }>({ context: { httpMethod: 'POST', path: '/test/ip' } }, false);
    assert(statusCode === 500);
  }

  @Test()
  async compressionReturned() {
    {
      const response = await this.request({ context: { httpMethod: 'GET', path: '/test/json' }, headers: { 'Accept-Encoding': 'gzip;q=1' } });
      assert(!response.headers.has('Content-Encoding'));
      assert.deepStrictEqual(response.body, { json: true });
    }
    for (const encoding of ['gzip', 'br', 'deflate']) {
      const response = await this.request({ context: { httpMethod: 'GET', path: '/test/json/large/20000' }, headers: { 'Accept-Encoding': `${encoding};q=1` } });
      const value = response.headers.get('Content-Encoding');
      assert(value === encoding);

      assert(response.body);
      assert(typeof response.body === 'object');
      assert('json' in response.body);
      assert(typeof response.body.json === 'string');
      assert(response.body.json.startsWith('0123456789'));
    }

    {
      const { headers } = await this.request({ context: { httpMethod: 'GET', path: '/test/json/large/50000' }, headers: { 'Accept-Encoding': 'orange' } }, false);
      assert(!('content-encoding' in headers));
      // assert(status === 406);
    }
  }

  @Test()
  async testWildcard() {
    const response = await this.request<{ path: string }>({ context: { httpMethod: 'GET', path: '/test/fun/1/2/3/4' } });
    assert(response.body?.path === '1/2/3/4');
  }
}
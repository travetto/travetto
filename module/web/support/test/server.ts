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
    const { body: ret } = await this.request('get', '/test/json');
    assert.deepStrictEqual(ret, { json: true });
  }

  @Test()
  async getParam() {
    const { body: ret } = await this.request('post', '/test/param/bob');
    assert.deepStrictEqual(ret, { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const { body: ret } = await this.request('put', '/test/query', {
      query: {
        age: '20'
      }
    });
    assert.deepStrictEqual(ret, { query: 20 });

    await assert.rejects(() => this.request('put', '/test/query', {
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async postBody() {
    const { body: ret } = await this.request('put', '/test/body', {
      body: {
        age: 20
      }
    });
    assert.deepStrictEqual(ret, { body: 20 });
  }

  @Test()
  async testCookie() {
    const { body: ret, headers } = await this.request('delete', '/test/cookie', {
      headers: {
        Cookie: 'orange=yummy'
      }
    });
    console.log('Headers', { headers });
    const cookie = Array.isArray(headers['set-cookie']) ? headers['set-cookie'][0] : headers['set-cookie'];
    assert(/flavor.*oreo/.test(cookie ?? ''));
    assert.deepStrictEqual(ret, { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const { body: ret } = await this.request('patch', '/test/regexp/super-poodle-party');
    assert.deepStrictEqual(ret, { path: 'poodle' });
  }

  @Test()
  async testBuffer() {
    const { body: ret } = await this.request('get', '/test/buffer');
    assert(ret === 'hello');
  }

  @Test()
  async testStream() {
    try {
      const { body: ret } = await this.request('get', '/test/stream');
      assert(ret === 'hello');
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const { body: ret } = await this.request('get', '/test/renderable');
    assert(ret === 'hello');
  }

  @Test()
  async testFullUrl() {
    const { body: ret } = await this.request('get', '/test/fullUrl');
    assert.deepStrictEqual(ret, { url: '/test/fullUrl', path: '/test/fullUrl' });
  }

  @Test()
  async testHeaderFirst() {
    const { body: ret } = await this.request('get', '/test/headerFirst', {
      headers: {
        age: ['1', '2', '3']
      }
    });
    assert.deepStrictEqual(ret, { header: '1' });
  }

  @Test()
  async testRawBody() {
    const { body: ret } = await this.request('post', '/test/rawBody', {
      headers: {
        'content-type': 'application/json'
      },
      body: `[${' '.repeat(18)}]`
    });
    assert.deepStrictEqual(ret, { size: 20 });
  }

  @Test()
  async testWildcard() {
    const { body: ret } = await this.request<{ path: string }>('get', '/test/fun/1/2/3/4');
    assert(ret.path === '1/2/3/4');
  }

  @Test()
  async testGetIp() {
    const { body: ret } = await this.request<{ ip: string | undefined }>('get', '/test/ip');
    assert(ret.ip === '127.0.0.1');

    const { body: ret2 } = await this.request<{ ip: string | undefined }>('get', '/test/ip', { headers: { 'X-Forwarded-For': 'bob' } });
    assert(ret2.ip === 'bob');
  }

  @Test()
  async compressionReturned() {
    {
      const { body: ret, headers } = await this.request('get', '/test/json', { headers: { 'Accept-Encoding': 'gzip;q=1' } });
      assert(headers['content-encoding'] === undefined);
      assert.deepStrictEqual(ret, { json: true });
    }
    for (const encoding of ['gzip', 'br', 'deflate']) {
      const { body: ret, headers } = await this.request('get', '/test/json/large/20000', { headers: { 'Accept-Encoding': `${encoding};q=1` } });
      if (Array.isArray(headers['content-encoding'])) {
        assert(headers['content-encoding'][0] === encoding);
      } else {
        assert(headers['content-encoding'] === encoding);
      }
      assert(ret && typeof ret === 'object');
      assert('json' in ret);
      assert(typeof ret.json === 'string');
      assert(ret.json.startsWith('0123456789'));
    }

    {
      const { status } = await this.request('get', '/test/json/large/50000', { headers: { 'Accept-Encoding': 'orange' }, throwOnError: false });
      assert(status === 406);
    }
  }
}
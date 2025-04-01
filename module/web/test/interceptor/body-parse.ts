import { Readable } from 'node:stream';
import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { BodyParseConfig, BodyParseInterceptor, HttpRequest, HttpResponse } from '@travetto/web';

@Suite()
class BodyParseInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicJSON() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const req = new HttpRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      inputStream: Readable.from(Buffer.from('{ "hello": "world" }', 'utf8'))
    });

    const res = await interceptor.filter({
      req,
      next: async () => HttpResponse.from(req.body),
      config
    });

    assert.deepStrictEqual(res.source, { hello: 'world' });
  }

  @Test()
  async basicText() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const req = new HttpRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      inputStream: Readable.from(Buffer.from('{ "hello": "world" }', 'utf8'))
    });

    const res = await interceptor.filter({
      req,
      next: async () => HttpResponse.from(req.body),
      config
    });

    assert.deepStrictEqual(res.source, '{ "hello": "world" }');
  }

  @Test()
  async basicBinary() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const stream = Readable.from(Buffer.alloc(1000));
    const req = new HttpRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      inputStream: stream
    });

    const res = await interceptor.filter({
      req,
      next: async () => HttpResponse.from(req.body),
      config
    });

    assert(res.source === stream);
  }
}
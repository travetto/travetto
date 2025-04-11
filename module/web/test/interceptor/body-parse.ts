import { Readable } from 'node:stream';
import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { BodyParseConfig, BodyParseInterceptor, WebRequest, WebResponse } from '@travetto/web';

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

    const req = new WebRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: WebRequest.markUnprocessed(Readable.from(Buffer.from('{ "hello": "world" }', 'utf8')))
    });

    const res = await interceptor.filter({
      req,
      next: async () => WebResponse.from(req.body),
      config
    });

    assert.deepStrictEqual(JSON.parse(res.body.toString('utf8')), { hello: 'world' });
  }

  @Test()
  async basicText() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const req = new WebRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: WebRequest.markUnprocessed(Readable.from(Buffer.from('{ "hello": "world" }', 'utf8')))
    });

    const res = await interceptor.filter({
      req,
      next: async () => WebResponse.from(req.body),
      config
    });

    assert.deepStrictEqual(res.body.toString('utf8'), '{ "hello": "world" }');
  }

  @Test()
  async basicBinary() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const stream = Readable.from(Buffer.alloc(1000));
    const req = new WebRequest({
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: WebRequest.markUnprocessed(stream)
    });

    const res = await interceptor.filter({
      req,
      next: async () => WebResponse.from(req.body),
      config
    });

    const resBuff = await res.getBodyAsBuffer();
    assert(resBuff.length === 1000);
    assert(!resBuff.some(x => x !== 0));
  }
}
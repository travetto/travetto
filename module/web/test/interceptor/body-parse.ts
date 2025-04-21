import { Readable } from 'node:stream';
import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { BodyParseConfig, BodyParseInterceptor, WebBodyUtil, WebRequest, WebResponse } from '@travetto/web';

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

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'application/json'
      },
      body: WebBodyUtil.markRaw(Buffer.from('{ "hello": "world" }', 'utf8'))
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    assert.deepStrictEqual(response.body, { hello: 'world' });
  }

  @Test()
  async basicText() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'text/plain'
      },
      body: WebBodyUtil.markRaw(Buffer.from('{ "hello": "world" }', 'utf8'))
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    assert.deepStrictEqual(`${response.body}`, '{ "hello": "world" }');
  }

  @Test()
  async basicBinary() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true
    });

    const stream = Readable.from(Buffer.alloc(1000));
    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: WebBodyUtil.markRaw(stream)
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    const responseBuffer = await WebBodyUtil.toBuffer(WebBodyUtil.toBinaryMessage(response).body!);
    assert(responseBuffer.length === 1000);
    assert(!responseBuffer.some(x => x !== 0));
  }
}
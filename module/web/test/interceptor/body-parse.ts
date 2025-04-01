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
  async basicTest() {
    const interceptor = new BodyParseInterceptor();
    const config = BodyParseConfig.from({
      applies: true,
      parsingTypes: {
        'text/html': 'text'
      }
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
}
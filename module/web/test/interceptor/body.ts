import { Readable } from 'node:stream';
import assert from 'node:assert';

import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { BodyInterceptor, WebBodyUtil, WebError, WebRequest, WebResponse } from '@travetto/web';
import { DependencyRegistryIndex } from '@travetto/di';
import { BinaryUtil } from '@travetto/runtime';

const mkData = (size: number) => BinaryUtil.fromUTF8String('A'.repeat(size));

@Suite()
class BodyInterceptorSuite {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async basicJSON() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'application/json'
      },
      body: WebBodyUtil.markRawBinary(BinaryUtil.fromUTF8String('{ "hello": "world" }'))
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
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'text/plain'
      },
      body: WebBodyUtil.markRawBinary(BinaryUtil.fromUTF8String('{ "hello": "world" }'))
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
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const stream = Readable.from(mkData(1000));
    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: WebBodyUtil.markRawBinary(stream)
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    const responseBuffer = await BinaryUtil.toBinaryArray(WebBodyUtil.toBinaryMessage(response).body!);
    assert(responseBuffer.byteLength === 1000);
    assert(!BinaryUtil.arrayToBuffer(responseBuffer).some(x => x !== 65));
  }

  @Test()
  async basicTextEncoding() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const fixtures = new TestFixtures();
    const koreanInput = await fixtures.read('/korean.euckr.txt', true);
    const koreanOutput = await fixtures.read('/korean.utf8.txt', true);

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'text/plain; charset=euc-kr',
      },
      body: WebBodyUtil.markRawBinary(koreanInput)
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    const responseBuffer = await BinaryUtil.toBinaryArray(WebBodyUtil.toBinaryMessage(response).body!);
    assert(responseBuffer.byteLength === koreanOutput.byteLength);
  }

  @Test()
  async basicTextEncodingSkipped() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const fixtures = new TestFixtures();
    const koreanInput = await fixtures.read('/korean.euckr.txt', true);

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'binary/ignore',
      },
      body: WebBodyUtil.markRawBinary(koreanInput)
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    const responseBuffer = await BinaryUtil.toBinaryArray(WebBodyUtil.toBinaryMessage(response).body!);
    assert(responseBuffer.byteLength === koreanInput.byteLength);
  }

  @Test()
  async basicTextEncodingWrong() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const fixtures = new TestFixtures();
    const koreanInput = await fixtures.read('/korean.euckr.txt', true);

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'text/plain', // Will use utf8
      },
      body: WebBodyUtil.markRawBinary(koreanInput)
    });

    const response = await interceptor.filter({
      request,
      next: async () => new WebResponse({ body: request.body }),
      config
    });

    const responseBuffer = await BinaryUtil.toBinaryArray(WebBodyUtil.toBinaryMessage(response).body!);
    assert(responseBuffer.byteLength === Buffer.from(koreanInput.toString('utf8')).byteLength);
  }

  @Test()
  async basicTextEncodingInvalid() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true };

    const request = new WebRequest({
      context: {
        path: '/',
        httpMethod: 'POST',
      },
      headers: {
        'Content-Type': 'text/plain; charset=orange',
      },
      body: WebBodyUtil.markRawBinary(mkData(0))
    });

    await assert.rejects(
      () => interceptor.filter({
        request,
        next: async () => new WebResponse({ body: request.body }),
        config
      }),
      e => e instanceof WebError && e.details.statusCode === 415
    );
  }

  @Test()
  async lengthEnforced() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true, limit: '10kb' as const };

    await assert.rejects(
      () => interceptor.filter({
        request: new WebRequest({
          context: {
            path: '/',
            httpMethod: 'POST',
          },
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '20000'
          },
          body: WebBodyUtil.markRawBinary(mkData(20000))
        }),
        next: async () => null!,
        config
      }),
      e => e instanceof WebError && e.details.statusCode === 413
    );

    await assert.rejects(
      () =>
        interceptor.filter({
          request: new WebRequest({
            context: {
              path: '/',
              httpMethod: 'POST',
            },
            headers: {
              'Content-Type': 'text/plain',
            },
            body: WebBodyUtil.markRawBinary(mkData(20000))
          }),
          next: async () => null!,
          config
        }),
      e => e instanceof WebError && e.details.statusCode === 413
    );
  }

  @Test()
  async lengthMismatched() {
    const interceptor = await DependencyRegistryIndex.getInstance(BodyInterceptor);
    const config = { ...interceptor.config, applies: true, limit: '50kb' as const };

    await assert.rejects(
      () => interceptor.filter({
        request: new WebRequest({
          context: {
            path: '/',
            httpMethod: 'POST',
          },
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '20000'
          },
          body: WebBodyUtil.markRawBinary(mkData(20001))
        }),
        next: async () => null!,
        config
      }),
      e => e instanceof WebError && e.details.statusCode === 400 && e.message.includes(' match ')
    );
  }
}
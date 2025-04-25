import { gunzipSync, brotliDecompressSync, inflateSync, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { CompressInterceptor, WebHeadersInit, WebRequest, WebResponse } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';
import { BinaryUtil } from '@travetto/runtime';

@Suite()
class BodyParseInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  async compress({ size, stream, requestHeaders: headers, responseHeaders }: {
    size: number;
    requestHeaders?: WebHeadersInit;
    responseHeaders?: WebHeadersInit;
    stream?: boolean;
  }): Promise<WebResponse> {
    const interceptor = await DependencyRegistry.getInstance(CompressInterceptor);
    interceptor.config.applies = true;

    let data: Readable | Buffer = Buffer.alloc(size);
    if (stream) {
      data = Readable.from(data);
    }

    try {
      return await interceptor.filter({
        request: new WebRequest({
          context: {
            path: '/',
            httpMethod: 'POST',
          },
          headers
        }),
        next: async () => new WebResponse({ body: data, headers: responseHeaders }),
        config: interceptor.config
      });
    } catch (err) {
      if (err instanceof WebResponse) {
        throw err.body;
      } else {
        throw err;
      }
    }
  }

  @Test()
  async basicSmall() {
    const response = await this.compress({
      size: 3000,
      requestHeaders: { 'Accept-Encoding': 'gzip ' }
    });
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength === 3000);
  }

  @Test()
  async basic() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'gzip' }
    });
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength < 50000);
  }

  @Test()
  async basicNoCache() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'gzip' },
      responseHeaders: { 'Cache-Control': 'no-transform' }
    });
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength === 50000);

    const response2 = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'identity' },
    });
    assert(Buffer.isBuffer(response2.body));
    assert(response2.body.byteLength === 50000);
  }

  @Test()
  async basicUnknown() {
    await assert.rejects(
      () =>
        this.compress({
          size: 50000,
          requestHeaders: { 'Accept-Encoding': 'gloop' }
        }),
      /gloop is not supported/
    );
  }

  @Test()
  async basicBrotliNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'br,gzip' }
    });

    assert(response.body);
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength < 50000);

    assert.doesNotThrow(() => brotliDecompressSync(response.body as Buffer));

    assert(brotliDecompressSync(response.body).byteLength === 50000);
  }

  @Test()
  async basicGzipNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'gzip,br' }
    });

    assert(response.body);
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength < 50000);

    assert.doesNotThrow(() => gunzipSync(response.body as Buffer));

    assert(gunzipSync(response.body).byteLength === 50000);
  }

  @Test()
  async basicDeflateNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'deflate,gzip,br' }
    });

    assert(response.body);
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength < 50000);

    assert.doesNotThrow(() => inflateSync(response.body as Buffer));

    assert(inflateSync(response.body).byteLength === 50000);
  }

  @Test()
  async basicWeightedNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'deflate;q=0.1,gzip;q=0.1,br;q=2' }
    });

    assert(response.body);
    assert(Buffer.isBuffer(response.body));
    assert(response.body.byteLength < 50000);

    assert.doesNotThrow(() => brotliDecompressSync(response.body as Buffer));

    assert(brotliDecompressSync(response.body).byteLength === 50000);
  }

  @Test()
  async basicStream() {
    const response = await this.compress({
      size: 50000,
      stream: true,
      requestHeaders: { 'Accept-Encoding': 'deflate;q=0.1,gzip;q=3,br;q=1' }
    });

    assert(response.body);
    assert(BinaryUtil.isReadable(response.body));

    const data = await buffer(response.body.pipe(createGunzip()));
    assert(data.byteLength === 50000);
  }
}
import { gunzipSync, brotliDecompressSync, inflateSync, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { CompressInterceptor, WebRequest, WebResponse } from '@travetto/web';
import { DependencyRegistry } from '@travetto/di';
import { BinaryUtil } from '@travetto/runtime';

@Suite()
class CompressInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  async compress({ size, stream, requestHeaders, responseHeaders }: {
    size: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
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
          headers: requestHeaders
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

    const body = response.body;
    assert(body);
    assert(Buffer.isBuffer(body));
    assert(body.byteLength < 50000);

    assert.doesNotThrow(() => brotliDecompressSync(body));

    assert(brotliDecompressSync(body).byteLength === 50000);
  }

  @Test()
  async basicGzipNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'gzip,br' }
    });

    const body = response.body;
    assert(body);
    assert(Buffer.isBuffer(body));
    assert(body.byteLength < 50000);

    assert.doesNotThrow(() => gunzipSync(body));

    assert(gunzipSync(body).byteLength === 50000);
  }

  @Test()
  async basicDeflateNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'deflate,gzip,br' }
    });

    const body = response.body;
    assert(body);
    assert(Buffer.isBuffer(body));
    assert(body.byteLength < 50000);

    assert.doesNotThrow(() => inflateSync(body));

    assert(inflateSync(body).byteLength === 50000);
  }

  @Test()
  async basicWeightedNegotiate() {
    const response = await this.compress({
      size: 50000,
      requestHeaders: { 'Accept-Encoding': 'deflate;q=0.1,gzip;q=0.1,br;q=2' }
    });

    const body = response.body;
    assert(body);
    assert(Buffer.isBuffer(body));
    assert(body.byteLength < 50000);

    assert.doesNotThrow(() => brotliDecompressSync(body));

    assert(brotliDecompressSync(body).byteLength === 50000);
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
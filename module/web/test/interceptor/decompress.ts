import assert from 'node:assert';
import { createBrotliCompress, brotliCompressSync, deflateSync, createDeflate, createGzip, gzipSync } from 'node:zlib';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { WebResponse, WebRequest, DecompressInterceptor, WebBodyUtil } from '@travetto/web';
import { RuntimeError, BinaryUtil, castTo, type BinaryType } from '@travetto/runtime';

@Suite()
class DecompressInterceptorSuite {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  async decompress({ data, encoding, requestHeaders = {}, responseHeaders = {} }: {
    encoding: 'gzip' | 'br' | 'deflate' | 'identity';
    data: number | BinaryType;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
  }): Promise<BinaryType> {
    const interceptor = await DependencyRegistryIndex.getInstance(DecompressInterceptor);
    interceptor.config.applies = true;

    if (typeof data === 'number') {
      data = BinaryUtil.makeBinaryArray(data, 'A');
    }

    if (BinaryUtil.isBinaryStream(data)) {
      switch (encoding) {
        case 'br': await BinaryUtil.pipeline(data, data = createBrotliCompress()); break;
        case 'gzip': await BinaryUtil.pipeline(data, data = createGzip()); break;
        case 'deflate': await BinaryUtil.pipeline(data, data = createDeflate()); break;
      }
    } else if (BinaryUtil.isBinaryArray(data)) {
      switch (encoding) {
        case 'br': data = brotliCompressSync(data); break;
        case 'gzip': data = gzipSync(data); break;
        case 'deflate': data = deflateSync(data); break;
      }
    }

    requestHeaders['Content-Encoding'] = encoding;

    try {
      const request = new WebRequest({
        context: {
          path: '/',
          httpMethod: 'POST',
        },
        body: WebBodyUtil.markRawBinary(data),
        headers: requestHeaders
      });
      await interceptor.filter({
        request,
        next: async () => new WebResponse({ headers: responseHeaders }),
        config: interceptor.config
      });
      if (BinaryUtil.isBinaryType(request.body)) {
        return request.body;
      } else {
        throw new RuntimeError('Unexpected return type');
      }
    } catch (err) {
      if (err instanceof WebResponse) {
        throw err.body;
      } else {
        throw err;
      }
    }
  }

  @Test()
  async simple() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'identity',
    });
    assert(response);
    assert(BinaryUtil.isBinaryArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleGzip() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'gzip',
    });
    assert(response);
    assert(BinaryUtil.isBinaryArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleBrotli() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'br',
    });
    assert(response);
    assert(BinaryUtil.isBinaryArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleDeflate() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'deflate',
    });
    assert(response);
    assert(BinaryUtil.isBinaryArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async preCompressed() {
    const preCompressed = gzipSync(BinaryUtil.makeBinaryArray(1000, 'A'));

    const response = await this.decompress({
      data: preCompressed,
      encoding: 'identity',
    });
    assert(response);
    assert(BinaryUtil.isBinaryArray(response));
    assert(response.byteLength === preCompressed.byteLength);
  }

  @Test()
  async stream() {
    const data = BinaryUtil.makeBinaryArray(1000, 'A');

    const response = await this.decompress({
      data: BinaryUtil.toReadableStream(data),
      encoding: 'gzip',
    });
    assert(response);
    assert(BinaryUtil.isBinaryStream(response));
    const received = await BinaryUtil.toBinaryArray(response);
    assert(received.byteLength === data.byteLength);
  }

  @Test()
  async invalid() {
    const data = BinaryUtil.makeBinaryArray(1000, 'A');

    await assert.rejects(
      () =>
        this.decompress({
          data: BinaryUtil.toReadableStream(data),
          encoding: castTo('google'),
        }),
      /Unsupported.*google/
    );
  }
}
import assert from 'node:assert';
import { brotliCompressSync, createBrotliCompress, createDeflate, createGzip, deflateSync, gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { WebResponse, WebRequest, DecompressInterceptor, WebBodyUtil } from '@travetto/web';
import { AppError, BinaryUtil, castTo, type BinaryType } from '@travetto/runtime';

const mkData = (size: number) => Buffer.alloc(size);

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
      data = mkData(data);
    }

    switch (encoding) {
      case 'br': {
        if (BinaryUtil.isByteArray(data)) {
          data = brotliCompressSync(data);
        } else if (BinaryUtil.isByteStream(data)) {
          await pipeline(data, data = createBrotliCompress());
        }
        break;
      }
      case 'gzip': {
        if (BinaryUtil.isByteArray(data)) {
          data = gzipSync(data);
        } else if (BinaryUtil.isByteStream(data)) {
          await pipeline(data, data = createGzip());
        }
        break;
      }
      case 'deflate': {
        if (BinaryUtil.isByteArray(data)) {
          data = deflateSync(data);
        } else if (BinaryUtil.isByteStream(data)) {
          await pipeline(data, data = createDeflate());
        }
        break;
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
        throw new AppError('Unexpected return type');
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
    assert(BinaryUtil.isByteArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleGzip() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'gzip',
    });
    assert(response);
    assert(BinaryUtil.isByteArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleBrotli() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'br',
    });
    assert(response);
    assert(BinaryUtil.isByteArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleDeflate() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'deflate',
    });
    assert(response);
    assert(BinaryUtil.isByteArray(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async preCompressed() {
    const preCompressed = gzipSync(mkData(1000));

    const response = await this.decompress({
      data: preCompressed,
      encoding: 'identity',
    });
    assert(response);
    assert(BinaryUtil.isByteArray(response));
    assert(response.byteLength === preCompressed.byteLength);
  }

  @Test()
  async stream() {
    const data = mkData(1000);

    const response = await this.decompress({
      data: Readable.from(data),
      encoding: 'gzip',
    });
    assert(response);

    assert(BinaryUtil.isByteStream(response));

    const received = await BinaryUtil.toByteArray(response);
    assert(received.byteLength === data.byteLength);
  }

  @Test()
  async invalid() {
    const data = mkData(1000);

    await assert.rejects(
      () =>
        this.decompress({
          data: Readable.from(data),
          encoding: castTo('google'),
        }),
      /Unsupported.*google/
    );
  }
}
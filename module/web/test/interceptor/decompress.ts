import assert from 'node:assert';
import { brotliCompressSync, createBrotliCompress, createDeflate, createGzip, deflateSync, gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RegistryV2 } from '@travetto/registry';
import { WebResponse, WebRequest, DecompressInterceptor, WebBodyUtil } from '@travetto/web';
import { AppError, BinaryUtil, castTo } from '@travetto/runtime';

@Suite()
class DecompressInterceptorSuite {

  @BeforeAll()
  async init() {
    await RegistryV2.init();
  }

  async decompress({ data, encoding, requestHeaders = {}, responseHeaders = {} }: {
    encoding: 'gzip' | 'br' | 'deflate' | 'identity';
    data: number | Buffer | Readable;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
  }): Promise<Buffer | Readable> {
    const interceptor = await DependencyRegistry.getInstance(DecompressInterceptor);
    interceptor.config.applies = true;

    if (typeof data === 'number') {
      data = Buffer.alloc(data);
    }

    switch (encoding) {
      case 'br': {
        if (Buffer.isBuffer(data)) {
          data = brotliCompressSync(data);
        } else {
          data = data.pipe(createBrotliCompress());
        }
        break;
      }
      case 'gzip': {
        if (Buffer.isBuffer(data)) {
          data = gzipSync(data);
        } else {
          data = data.pipe(createGzip());
        }
        break;
      }
      case 'deflate': {
        if (Buffer.isBuffer(data)) {
          data = deflateSync(data);
        } else {
          data = data.pipe(createDeflate());
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
        body: WebBodyUtil.markRaw(data),
        headers: requestHeaders
      });
      await interceptor.filter({
        request,
        next: async () => new WebResponse({ headers: responseHeaders }),
        config: interceptor.config
      });
      if (Buffer.isBuffer(request.body) || BinaryUtil.isReadable(request.body)) {
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
    assert(Buffer.isBuffer(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleGzip() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'gzip',
    });
    assert(response);
    assert(Buffer.isBuffer(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleBrotli() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'br',
    });
    assert(response);
    assert(Buffer.isBuffer(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async simpleDeflate() {
    const response = await this.decompress({
      data: 10000,
      encoding: 'deflate',
    });
    assert(response);
    assert(Buffer.isBuffer(response));
    assert(response.byteLength === 10000);
  }

  @Test()
  async preCompressed() {
    const preCompressed = gzipSync(Buffer.alloc(1000));

    const response = await this.decompress({
      data: preCompressed,
      encoding: 'identity',
    });
    assert(response);
    assert(Buffer.isBuffer(response));
    assert(response.byteLength === preCompressed.length);
  }

  @Test()
  async stream() {
    const data = Buffer.alloc(1000);

    const response = await this.decompress({
      data: Readable.from(data),
      encoding: 'gzip',
    });
    assert(response);
    assert(BinaryUtil.isReadable(response));
    assert((await buffer(response)).byteLength === data.length);
  }

  @Test()
  async invalid() {
    const data = Buffer.alloc(1000);

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
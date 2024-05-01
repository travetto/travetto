import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { MimeUtil, Request } from '@travetto/rest';

import { RestUploadUtil } from '../src/util';

function makeRequest(filename: string | undefined, type: string): Request {
  return {
    getContentType() {
      return MimeUtil.parse(type);
    },
    header(key: string) {
      switch (key) {
        case 'content-type': return type;
        case 'content-disposition': return filename ? `filename=${filename}` : filename;
      }
    }
  } as Request;
}

@Suite()
export class UtilTest {

  @Test()
  extractFilename() {
    const req = makeRequest('"hello-world"', 'image/png');
    assert(RestUploadUtil.getFileName(req) === 'hello-world');

    const req2 = makeRequest('hello-world', 'image/png');
    assert(RestUploadUtil.getFileName(req2) === 'hello-world');

    const req3 = makeRequest(undefined, 'image/png');
    assert(RestUploadUtil.getFileName(req3 as Request) === 'file-upload.png');
  }

  @Test({ shouldThrow: 'size' })
  async testMaxBlobWrite() {
    await RestUploadUtil.writeToBlob(Buffer.alloc(100, 'A', 'utf8'), 'test', 1);
  }

  @Test({ shouldThrow: 'size' })
  async testMaxCloseBlobWrite() {
    await RestUploadUtil.writeToBlob(Buffer.alloc(100, 'A', 'utf8'), 'test', 99);
  }

  @Test()
  async testMaxExactBlobWrite() {
    await RestUploadUtil.writeToBlob(Buffer.alloc(100, 'A', 'utf8'), 'test', 100);
  }
}
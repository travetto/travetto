import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { MimeUtil, Request } from '@travetto/rest';

import { AssetRestUtil } from '../src/util';

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
    assert(AssetRestUtil.getFileName(req) === 'hello-world');

    const req2 = makeRequest('hello-world', 'image/png');
    assert(AssetRestUtil.getFileName(req2) === 'hello-world');

    const req3 = makeRequest(undefined, 'image/png');
    assert(AssetRestUtil.getFileName(req3 as Request) === 'file-upload.png');
  }
}
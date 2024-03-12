import assert from 'node:assert';

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

  @Test()
  async hashUrl() {
    const hash2 = await AssetRestUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(hash2.length === 64);

    const hash3 = await AssetRestUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 1000001);
    assert(hash3.length === 64);

    assert(hash3 !== hash2);

    const hashFull = await AssetRestUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg');
    assert(hashFull.length === 64);
    assert(hashFull === '4c6ab4f3fcd07005294391de6b7d83bca59397344f5897411ed5316e212e46c7');
  }
}
import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { Request } from '@travetto/rest';
import { AssetRestUtil } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  validateMimesAllowDeny() {
    const validator = AssetRestUtil.mimeValidator(['image/*'], ['image/tiff']);

    assert.doesNotThrow(() => validator({ contentType: 'image/png' }));
    assert.throws(() => validator({ contentType: 'image/tiff' }));
    assert.throws(() => validator({ contentType: 'image' }));
    assert.throws(() => validator({ contentType: 'img' }));
  }

  @Test()
  validateDeny() {
    const validator = AssetRestUtil.mimeValidator([], ['image/tiff']);

    assert.doesNotThrow(() => validator({ contentType: 'image/png' }));
    assert.throws(() => validator({ contentType: 'image/tiff' }));
    assert.doesNotThrow(() => validator({ contentType: 'image' }));
    assert.doesNotThrow(() => validator({ contentType: 'img' }));
  }

  @Test()
  validateAllow() {
    const validator = AssetRestUtil.mimeValidator(['image/*']);

    assert.doesNotThrow(() => validator({ contentType: 'image/png' }));
    assert.doesNotThrow(() => validator({ contentType: 'image/tiff' }));
    assert.throws(() => validator({ contentType: 'image' }));
    assert.throws(() => validator({ contentType: 'img' }));
  }

  @Test()
  extractFilename() {
    const req = {
      header(key: string) {
        switch (key) {
          case 'content-type': return 'image/png';
          case 'content-disposition': return 'filename="hello-world"';
        }
      }
    };

    assert(AssetRestUtil.getFileName(req as Request) === 'hello-world');

    const req2 = {
      header(key: string) {
        switch (key) {
          case 'content-type': return 'image/png';
          case 'content-disposition': return 'filename=hello-world';
        }
      }
    };

    assert(AssetRestUtil.getFileName(req2 as Request) === 'hello-world');

    const req3 = {
      header(key: string) {
        switch (key) {
          case 'content-type': return 'image/png';
        }
      }
    };

    assert(AssetRestUtil.getFileName(req3 as Request) === 'file-upload.png');
  }
}
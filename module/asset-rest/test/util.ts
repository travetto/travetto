import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { AssetRestUtil } from '../src/util';

@Suite()
export class UtilTest {
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

    assert(AssetRestUtil.getFileName(req as any) === 'hello-world');

    const req2 = {
      header(key: string) {
        switch (key) {
          case 'content-type': return 'image/png';
          case 'content-disposition': return 'filename=hello-world';
        }
      }
    };

    assert(AssetRestUtil.getFileName(req2 as any) === 'hello-world');

    const req3 = {
      header(key: string) {
        switch (key) {
          case 'content-type': return 'image/png';
        }
      }
    };

    assert(AssetRestUtil.getFileName(req3 as any) === 'file-upload.png');
  }
}
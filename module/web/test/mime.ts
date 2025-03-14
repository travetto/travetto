import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { MimeUtil } from '../src/util/mime.ts';

@Suite()
export class MimeUtilSuite {

  @Test()
  validateMimesAllowDeny() {
    const validator = MimeUtil.matcher(['!image/tiff', 'image/*']);

    assert(validator('image/png'));
    assert(!validator('image/tiff'));
    assert(!validator('image'));
    assert(!validator('img'));
  }

  @Test()
  validateDeny() {
    const validator = MimeUtil.matcher(['!image/tiff']);

    assert(validator('image/png'));
    assert(!validator('image/tiff'));
    assert(validator('image'));
    assert(validator('img'));
  }

  @Test()
  validateAllow() {
    const validator = MimeUtil.matcher(['image/*']);

    assert(validator('image/png'));
    assert(validator('image/tiff'));
    assert(!validator('image'));
    assert(!validator('img'));
  }
}
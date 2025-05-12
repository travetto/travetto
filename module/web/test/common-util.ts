import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { WebCommonUtil } from '@travetto/web';

@Suite()
export class WebCommonUtilTest {

  @Test()
  orderDependents() {
    const items = [
      {
        key: 'first'
      },
      {
        after: ['first', 'fourth'],
        key: 'fifth'
      },
      {
        after: ['first'],
        key: 'third'
      },
      {
        after: ['first'],
        key: 'second'
      },
      {
        after: ['first', 'second'],
        key: 'fourth'
      },
      {
        after: ['fifth'],
        key: 'sixth'
      }
    ] as const;

    const ordered = WebCommonUtil.ordered(items);
    assert.deepStrictEqual(ordered.map(x => x.key), ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    const ordered2 = WebCommonUtil.ordered([
      { key: 'tenth', before: ['second'] },
      ...items
    ]);
    assert.deepStrictEqual(ordered2.map(x => x.key), ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }


  @Test()
  validateMimesAllowDeny() {
    const validator = WebCommonUtil.mimeTypeMatcher(['!image/tiff', 'image/*']);

    assert(validator('image/png'));
    assert(!validator('image/tiff'));
    assert(!validator('image'));
    assert(!validator('img'));
  }

  @Test()
  validateDeny() {
    const validator = WebCommonUtil.mimeTypeMatcher(['!image/tiff']);

    assert(validator('image/png'));
    assert(!validator('image/tiff'));
    assert(validator('image'));
    assert(validator('img'));
  }

  @Test()
  validateAllow() {
    const validator = WebCommonUtil.mimeTypeMatcher(['image/*']);

    assert(validator('image/png'));
    assert(validator('image/tiff'));
    assert(!validator('image'));
    assert(!validator('img'));
  }
}
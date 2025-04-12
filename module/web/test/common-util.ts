import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { CookieJar } from '../src/util/cookie.ts';
import { WebCommonUtil } from '../src/util/common.ts';
import { WebRequest } from '../src/types/request.ts';
import { WebResponse } from '../src/types/response.ts';

const KEY = 'test';
const config = (mode: 'cookie' | 'header', signed = true) => ({ cookie: 'orange', header: 'dandy', mode, ...signed ? { signingKey: KEY } : {} });

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
  async writeValueCookieTest() {
    const res = WebCommonUtil.writeMetadata(WebResponse.from(null), config('cookie', false), 'blue');

    const jar = new CookieJar(res.cookies);
    assert(jar.get('orange') === 'blue');

    WebCommonUtil.writeMetadata(res, config('cookie'), undefined);

    const jar2 = new CookieJar(res.cookies);
    assert(jar2.get('orange') === undefined);
  }

  @Test()
  async writeValueHeaderTest() {
    const res = WebCommonUtil
      .writeMetadata(WebResponse.from(null), config('header', false), 'blue');
    assert(res.headers.get('Dandy') === 'blue');

    const res2 = WebCommonUtil
      .writeMetadata(WebResponse.from(null), config('header'), undefined);
    assert(!res2.headers.get('Dandy'));

    WebCommonUtil.writeMetadata(res, config('header'), undefined);
    assert(!res.headers.get('Dandy'));
  }

  @Test()
  async readValueHeaderTest() {
    const req = new WebRequest({ headers: { dandy: 'howdy' } });
    const value = WebCommonUtil.readMetadata(req, config('header', false));
    assert(value);
    assert(value === 'howdy');

    const missing = WebCommonUtil.readMetadata(req, { mode: 'header', header: 'zzzz', cookie: '' });
    assert(missing === undefined);
  }

  @Test()
  async readWriteValueTest() {
    const cfg = config('header', false);
    const res = WebCommonUtil.writeMetadata(WebResponse.from(null), cfg, 'hello');

    const req = new WebRequest({ headers: res.headers });
    const value = WebCommonUtil.readMetadata(req, cfg);

    assert(value === 'hello');
  }
}
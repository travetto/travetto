import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { WebCommonUtil } from '../src/util/common.ts';
import { HttpRequest } from '../src/types/request.ts';
import { HttpResponse } from '../src/types/response.ts';
import { castTo } from '@travetto/runtime';
import { CookieJar } from '@travetto/web';

const mockRequest = (res: HttpResponse): HttpRequest => new HttpRequest(castTo({ headers: res.headers }));

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
    const res = HttpResponse.fromEmpty()
      .writeMetadata(config('cookie', false), 'blue');

    const jar = new CookieJar(res.getCookies());
    assert(jar.get('orange') === 'blue');

    res.writeMetadata(config('cookie'), undefined);

    const jar2 = new CookieJar(res.getCookies());
    assert(jar2.get('orange') === undefined);
  }

  @Test()
  async writeValueHeaderTest() {
    const res = HttpResponse.fromEmpty()
      .writeMetadata(config('header', false), 'blue');
    assert(res.headers.get('Dandy') === 'blue');

    const res2 = HttpResponse.fromEmpty()
      .writeMetadata(config('header'), undefined);
    assert(!res2.headers.get('Dandy'));

    res.writeMetadata(config('header'), undefined);
    assert(!res.headers.get('Dandy'));
  }

  @Test()
  async readValueHeaderTest() {
    const req = mockRequest(HttpResponse.fromEmpty().with({ headers: { dandy: 'howdy' } }));
    const value = await req.readMetadata(config('header', false));
    assert(value);
    assert(value === 'howdy');

    const missing = await req.readMetadata({ mode: 'header', header: 'zzzz', cookie: '' });
    assert(missing === undefined);
  }

  @Test()
  async readWriteValueTest() {
    const cfg = config('header', false);
    const res = HttpResponse.fromEmpty();
    await res.writeMetadata(cfg, 'hello');

    const req = mockRequest(res);
    const value = await req.readMetadata(cfg);

    assert(value === 'hello');
  }
}
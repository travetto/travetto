import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { castTo } from '@travetto/runtime';

import { WebCommonUtil } from '../src/util/common.ts';
import { HttpRequest } from '../src/types.ts';
import { HttpPayload } from '../src/response/payload.ts';

const mockRequest = (payload: HttpPayload): HttpRequest =>
  castTo({
    headerFirst(key: string) { return payload.getHeader(key); },
    getHeader(key: string) { return payload.getHeader(key); },
    cookies: { get(key: string) { return payload.getCookie(key); } }
  });

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
    const res = HttpPayload.fromEmpty();
    WebCommonUtil.writeValue(config('cookie', false), res, 'blue');
    assert(res.getCookie('orange') === 'blue');

    WebCommonUtil.writeValue(config('cookie'), res, undefined);
    assert(res.hasCookie('orange'));
    assert(res.getCookie('orange') === undefined);

  }

  @Test()
  async writeValueHeaderTest() {
    const res = HttpPayload.fromEmpty();
    WebCommonUtil.writeValue(config('header', false), res, 'blue');
    assert(res.getHeader('dandy') === 'blue');

    const res2 = HttpPayload.fromEmpty();
    WebCommonUtil.writeValue(config('header'), res2, undefined);
    assert(!res2.getHeader('dandy'));

    WebCommonUtil.writeValue(config('header'), res, undefined);
    assert(!res.getHeader('dandy'));
  }

  @Test()
  async readValueHeaderTest() {
    const req = mockRequest(HttpPayload.fromEmpty().with({ headers: { dandy: 'howdy' } }));
    const value = await WebCommonUtil.readValue(config('header', false), req);
    assert(value);
    assert(value === 'howdy');

    const missing = await WebCommonUtil.readValue({ mode: 'header', header: 'zzzz', cookie: '' }, req);
    assert(missing === undefined);
  }

  @Test()
  async readWriteValueTest() {
    const cfg = config('header', false);
    const res = HttpPayload.fromEmpty();
    await WebCommonUtil.writeValue(cfg, res, 'hello');

    const req = mockRequest(res);
    const value = await WebCommonUtil.readValue(cfg, req);

    assert(value === 'hello');
  }
}
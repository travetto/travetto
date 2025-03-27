import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { WebCommonUtil } from '../src/util/common.ts';
import { HttpRequest } from '../src/types.ts';
import { HttpPayload } from '../src/response/payload.ts';
import { HttpRequestCore } from '../src/request/core.ts';
import { castTo } from '@travetto/runtime';

const mockRequest = (payload: HttpPayload): HttpRequest =>
  HttpRequestCore.create(
    {
      getHeaderFirst: castTo((key: string) => payload.getHeader(key)),
      getHeader: castTo((key: string) => payload.getHeader(key))
    },
    null!
  );

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
    const res = HttpPayload.fromEmpty()
      .writeMetadata(config('cookie', false), 'blue');
    assert(res.getCookie('orange') === 'blue');

    res.writeMetadata(config('cookie'), undefined);
    assert(res.hasCookie('orange'));
    assert(res.getCookie('orange') === undefined);

  }

  @Test()
  async writeValueHeaderTest() {
    const res = HttpPayload.fromEmpty()
      .writeMetadata(config('header', false), 'blue');
    assert(res.getHeader('dandy') === 'blue');

    const res2 = HttpPayload.fromEmpty()
      .writeMetadata(config('header'), undefined);
    assert(!res2.getHeader('dandy'));

    res.writeMetadata(config('header'), undefined);
    assert(!res.getHeader('dandy'));
  }

  @Test()
  async readValueHeaderTest() {
    const req = mockRequest(HttpPayload.fromEmpty().with({ headers: { dandy: 'howdy' } }));
    const value = await req.readMetadata(config('header', false));
    assert(value);
    assert(value === 'howdy');

    const missing = await req.readMetadata({ mode: 'header', header: 'zzzz', cookie: '' });
    assert(missing === undefined);
  }

  @Test()
  async readWriteValueTest() {
    const cfg = config('header', false);
    const res = HttpPayload.fromEmpty();
    await res.writeMetadata(cfg, 'hello');

    const req = mockRequest(res);
    const value = await req.readMetadata(cfg);

    assert(value === 'hello');
  }
}
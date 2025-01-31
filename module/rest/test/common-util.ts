import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { castTo } from '@travetto/runtime';

import { RestCommonUtil } from '../src/util/common';
import { Response, Request } from '../src/types';

type Meta = Record<'headerData' | 'cookieData', Record<string, string | undefined>>;
type MockResponse = Response & Meta;
type MockRequest = Request;

const mockResponse = (data?: Partial<Meta>): MockResponse => {
  const meta = { headerData: {}, cookieData: {}, ...data };
  return castTo({
    headerData: meta.headerData,
    cookieData: meta.cookieData,
    setHeader(key: string, value: string) { meta.headerData[key] = value; },
    removeHeader(key: string) { delete meta.headerData[key]; },
    cookies: { set(key: string, value: string) { meta.cookieData[key] = value; } }
  });
};

const mockRequest = (data: Partial<Meta> = {}): MockRequest => {
  const meta = { headerData: {}, cookieData: {}, ...data };
  return castTo({
    headerFirst(key: string) { return meta.headerData[key]; },
    getHeader(key: string) { return meta.headerData[key]; },
    cookies: { get(key: string) { return meta.cookieData[key]; } }
  });
};

const KEY = 'test';
const config = (mode: 'cookie' | 'header', signed = true) => ({ cookie: 'orange', header: 'dandy', mode, ...signed ? { signingKey: KEY } : {} });

@Suite()
export class RestCommonUtilTest {

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

    const ordered = RestCommonUtil.ordered(items);
    assert.deepStrictEqual(ordered.map(x => x.key), ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    const ordered2 = RestCommonUtil.ordered([
      { key: 'tenth', before: ['second'] },
      ...items
    ]);
    assert.deepStrictEqual(ordered2.map(x => x.key), ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }

  @Test()
  async writeValueCookieTest() {
    const res = mockResponse();
    RestCommonUtil.writeValue(config('cookie', false), res, 'blue');
    assert(res.cookieData.orange);
    assert(res.cookieData.orange === 'blue');

    RestCommonUtil.writeValue(config('cookie'), res, undefined);
    assert('orange' in res.cookieData);
    assert(res.cookieData.orange === undefined);

  }

  @Test()
  async writeValueHeaderTest() {
    const res = mockResponse();
    RestCommonUtil.writeValue(config('header', false), res, 'blue');
    assert(res.headerData.dandy);
    assert(res.headerData.dandy === 'blue');

    const res2 = mockResponse();
    RestCommonUtil.writeValue(config('header'), res2, undefined);
    assert(!res2.headerData.dandy);

    RestCommonUtil.writeValue(config('header'), res, undefined);
    assert(!res.headerData.dandy);
  }

  @Test()
  async readValueHeaderTest() {
    const req = mockRequest({ headerData: { dandy: 'howdy' } });
    const value = await RestCommonUtil.readValue(config('header', false), req);
    assert(value);
    assert(value === 'howdy');

    const missing = await RestCommonUtil.readValue({ mode: 'header', header: 'zzzz', cookie: '' }, req);
    assert(missing === undefined);
  }

  @Test()
  async readWriteValueTest() {
    const cfg = config('header', false);
    const res = mockResponse();
    await RestCommonUtil.writeValue(cfg, res, 'hello');

    const req = mockRequest(res);
    const value = await RestCommonUtil.readValue(cfg, req);

    assert(value === 'hello');
  }
}
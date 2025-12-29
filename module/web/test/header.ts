import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

import { WebHeaderUtil } from '../src/util/header.ts';
import { WebHeaders } from '../src/types/headers.ts';
import { Cookie } from '../src/types/cookie.ts';

@Suite('WebHeaderUtil')
class WebHeaderUtilSuite {

  @Test('parseCookieHeader - empty and single')
  testParseCookieHeader() {
    assert(WebHeaderUtil.parseCookieHeader('').length === 0);
    const single = WebHeaderUtil.parseCookieHeader('foo=bar');
    assert(single.length === 1);
    assert(single[0].name === 'foo');
    assert(single[0].value === 'bar');
    const multi = WebHeaderUtil.parseCookieHeader('foo = bar;   baz= qux       ');
    assert(multi.length === 2);
    assert(multi[0].name === 'foo');
    assert(multi[0].value === 'bar');
    assert(multi[1].name === 'baz');
    assert(multi[1].value === 'qux');
  }

  @Test('parseSetCookieHeader - with attributes')
  testParseSetCookieHeader() {
    const cookie = WebHeaderUtil.parseSetCookieHeader('foo=bar; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT');
    console.log(cookie);
    assert(cookie.name === 'foo');
    assert(cookie.value === 'bar');
    assert(cookie.path === '/');
    assert(cookie.secure === true);
    assert(cookie.httponly === true);
    assert(cookie.expires instanceof Date);
    assert(cookie.expires.toUTCString() === 'Wed, 21 Oct 2015 07:28:00 GMT');
  }

  @Test('parseHeaderSegment - with parameters and q')
  testParseHeaderSegment() {
    const seg = WebHeaderUtil.parseHeaderSegment('text/html; q=0.8; charset="utf-8"');
    assert(seg.value === 'text/html');
    assert(seg.parameters.q === '0.8');
    assert(seg.parameters.charset === 'utf-8');
    assert(seg.q === 0.8);
  }

  @Test('parseHeader - multiple segments')
  testParseHeader() {
    const arr = WebHeaderUtil.parseHeader('text/html; q=0.8, application/json; q=1.0');
    assert(arr.length === 2);
    assert(arr[0].value === 'text/html');
    assert(arr[1].value === 'application/json');
    assert(arr[1].q === 1.0);
  }

  @Test('buildCookieSuffix - all attributes')
  testBuildCookieSuffix() {
    const c: Cookie = {
      name: 'foo',
      value: 'bar',
      path: '/',
      expires: new Date('2020-01-01T00:00:00Z'),
      domain: 'example.com',
      priority: 'high',
      sameSite: 'strict',
      secure: true,
      httponly: true,
      partitioned: true
    };
    const parts = WebHeaderUtil.buildCookieSuffix(c);
    assert(parts.includes('path=/'));
    assert(parts.includes('expires=Wed, 01 Jan 2020 00:00:00 GMT'));
    assert(parts.includes('domain=example.com'));
    assert(parts.includes('priority=high'));
    assert(parts.includes('samesite=strict'));
    assert(parts.includes('secure'));
    assert(parts.includes('httponly'));
    assert(parts.includes('partitioned'));
  }

  @Test('negotiateHeader - wildcard and q')
  testNegotiateHeader() {
    assert(WebHeaderUtil.negotiateHeader('*', ['json', 'html']) === 'json');
    assert(WebHeaderUtil.negotiateHeader('html;q=0.5, json;q=1.0', ['json', 'html']) === 'json');
    assert(WebHeaderUtil.negotiateHeader('foo, html', ['json', 'html']) === 'html');
    assert(WebHeaderUtil.negotiateHeader('foo', ['json', 'html']) === undefined);
  }

  @Test('negotiateHeader - case insensitivity and whitespace')
  testNegotiateHeaderCaseWhitespace() {
    assert(WebHeaderUtil.negotiateHeader('JSON', ['json', 'html']) === 'json');
    assert(WebHeaderUtil.negotiateHeader('  html  ; q=0.9  ,  json ;q=0.8 ', ['json', 'html']) === 'html');
    assert(WebHeaderUtil.negotiateHeader('application/json', ['application/json', 'text/html']) === 'application/json');
  }

  @Test('negotiateHeader - q value tie breaker and order')
  testNegotiateHeaderQOrder() {
    // Both have q=1.0, should pick first in order
    assert(WebHeaderUtil.negotiateHeader('json;q=1.0,html;q=1.0', ['html', 'json']) === 'json');
    // Lower q should not be picked if higher q exists
    assert(WebHeaderUtil.negotiateHeader('json;q=0.5,html;q=1.0', ['json', 'html']) === 'html');
    // If all q=0, should return undefined
    assert(WebHeaderUtil.negotiateHeader('json;q=0,html;q=0', ['json', 'html']) === undefined);
  }

  @Test('getRange - valid and invalid')
  testGetRange() {
    const headers = new WebHeaders({ Range: 'bytes=100-200' });
    const range = WebHeaderUtil.getRange(headers, 1024);
    assert(range);
    assert(range.start === 100);
    assert(range.end === 200);

    const headers2 = new WebHeaders({ Range: 'bytes=100-' });
    const range2 = WebHeaderUtil.getRange(headers2, 50);
    assert(range2);
    assert(range2.start === 100);
    assert(range2.end === 150);

    const headers3 = new WebHeaders({});
    assert(WebHeaderUtil.getRange(headers3) === undefined);
  }

  @Test('isFresh - cache control and etag')
  testIsFresh() {
    // No-cache disables freshness
    let req = new WebHeaders({ 'Cache-Control': 'no-cache' });
    let res = new WebHeaders({});
    assert(!WebHeaderUtil.isFresh(req, res));

    // ETag match
    req = new WebHeaders({ 'If-None-Match': 'abc' });
    res = new WebHeaders({ ETag: 'abc' });
    assert(WebHeaderUtil.isFresh(req, res));

    // ETag wildcard
    req = new WebHeaders({ 'If-None-Match': '*' });
    res = new WebHeaders({ ETag: 'abc' });
    assert(WebHeaderUtil.isFresh(req, res));

    // ETag no match
    req = new WebHeaders({ 'If-None-Match': 'def' });
    res = new WebHeaders({ ETag: 'abc' });
    assert(!WebHeaderUtil.isFresh(req, res));

    // If-Modified-Since and Last-Modified
    req = new WebHeaders({ 'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    res = new WebHeaders({ 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert(WebHeaderUtil.isFresh(req, res));

    // If-Modified-Since newer than Last-Modified
    req = new WebHeaders({ 'If-Modified-Since': 'Thu, 22 Oct 2015 07:28:00 GMT' });
    res = new WebHeaders({ 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert(!WebHeaderUtil.isFresh(req, res));
  }

  @Test('isFresh - additional scenarios')
  testIsFreshAdditional() {
    // No conditional headers, should not be fresh
    let req = new WebHeaders({});
    let res = new WebHeaders({});
    assert(!WebHeaderUtil.isFresh(req, res));

    // If-None-Match with multiple values, one matches
    req = new WebHeaders({ 'If-None-Match': 'abc, def, ghi' });
    res = new WebHeaders({ ETag: 'def' });
    assert(WebHeaderUtil.isFresh(req, res));

    // If-None-Match with weak ETag match
    req = new WebHeaders({ 'If-None-Match': 'W/"abc"' });
    res = new WebHeaders({ ETag: 'W/"abc"' });
    assert(WebHeaderUtil.isFresh(req, res));

    // If-None-Match with weak/strong mismatch (should not match)
    req = new WebHeaders({ 'If-None-Match': 'W/"abc"' });
    res = new WebHeaders({ ETag: '"abc"' });
    assert(WebHeaderUtil.isFresh(req, res));

    // If-Modified-Since equal to Last-Modified (fresh)
    req = new WebHeaders({ 'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    res = new WebHeaders({ 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert(WebHeaderUtil.isFresh(req, res));

    // If-Modified-Since with invalid date (should not be fresh)
    req = new WebHeaders({ 'If-Modified-Since': 'invalid-date' });
    res = new WebHeaders({ 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert(!WebHeaderUtil.isFresh(req, res));

    // If-None-Match present, If-Modified-Since present, ETag matches, should be fresh
    req = new WebHeaders({ 'If-None-Match': 'abc', 'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    res = new WebHeaders({ ETag: 'abc', 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert(WebHeaderUtil.isFresh(req, res));
  }
}
import * as assert from 'assert';

import { Controller, Get, Body, Post, Put, Request } from '@travetto/rest';
import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test.suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { Util } from '@travetto/base';

import { SessionData, SessionConfig } from '..';

type Aged = { age: number, payload?: Record<string, unknown> };

@Controller('/test/session')
class TestController {

  @Get('/')
  get(data: SessionData): SessionData {
    data.age = (data.age ?? 0) + 1;
    return data;
  }

  @Post('/complex')
  withParam(@Body() payload: unknown, data: SessionData) {
    data.payload = payload;
  }

  @Put('/body')
  withBody(req: Request) {
    return { body: req.body.age };
  }
}

@Suite()
@InjectableSuite()
export abstract class RestSessionServerSuite extends BaseRestSuite {

  @Inject()
  config: SessionConfig;

  initConfig(opt: Partial<SessionConfig>) {
    return Object.assign(this.config, opt);
  }

  @Test()
  async cookiePersistence() {
    this.initConfig({
      transport: 'cookie',
      maxAge: 10000
    });

    let res = await this.request<Aged>('get', '/test/session');
    let cookie = res.headers['set-cookie'];
    assert.deepStrictEqual(res.body, { age: 1 });
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'] ?? cookie;
    assert.deepStrictEqual(res.body, { age: 2 });
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'] ?? cookie;
    assert.deepStrictEqual(res.body, { age: 3 });
    res = await this.request('get', '/test/session');
    assert.deepStrictEqual(res.body, { age: 1 });
    cookie = res.headers['set-cookie'] ?? cookie;
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert.deepStrictEqual(res.body, { age: 2 });
  }

  @Test()
  async cookieComplex() {
    this.initConfig({
      transport: 'cookie',
      maxAge: 3000
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async cookieNoSession() {
    this.initConfig({
      transport: 'cookie',
      maxAge: 3000
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const cookie = res.headers['set-cookie'];
    assert(cookie === undefined);
  }

  @Test()
  async headerPersistence() {
    const { keyName: key } = this.initConfig({
      transport: 'header',
      renew: true,
      maxAge: 3000
    });

    let res = await this.request('get', '/test/session');
    let header = res.headers[key];
    assert.deepStrictEqual(res.body, { age: 1 });
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert.deepStrictEqual(res.body, { age: 2 });
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert.deepStrictEqual(res.body, { age: 3 });

    res = await this.request('get', '/test/session');
    header = res.headers[key] ?? header;

    assert.deepStrictEqual(res.body, { age: 1 });
    header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert.deepStrictEqual(res.body, { age: 2 });
  }

  @Test()
  async headerComplex() {
    const { keyName: key } = this.initConfig({
      transport: 'header',
      maxAge: 3000
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerNoSession() {
    const { keyName: key } = this.initConfig({
      transport: 'header',
      maxAge: 100
    });


    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const cookie = res.headers[key];
    assert(cookie === undefined);
  }

  @Test()
  async testExpiryHeader() {
    const { keyName: key } = this.initConfig({
      transport: 'header',
      maxAge: 100
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    let header = res.headers[key];

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await Util.wait(100);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryCookie() {
    this.initConfig({
      transport: 'cookie',
      maxAge: 100
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await Util.wait(100);

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryWithExtend() {
    const { keyName: key } = this.initConfig({
      transport: 'header',
      maxAge: 300
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    let header = res.headers[key];

    await Util.wait(50);
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    await Util.wait(50);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    await Util.wait(50);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    assert(res.body.age === 3);
  }
}
import assert from 'node:assert';
import timers from 'node:timers/promises';

import { AuthConfig, AuthContext } from '@travetto/auth';
import { AuthReadWriteInterceptor, RestAuthConfig } from '@travetto/auth-rest';
import { SessionService, SessionData } from '@travetto/auth-session';
import { Inject, Injectable } from '@travetto/di';
import { Controller, Get, Body, Post, Put, Request, FilterContext, RestInterceptor, RouteConfig } from '@travetto/rest';
import { Util } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';

type Aged = { age: number, payload?: Record<string, unknown> };

@Injectable()
class AutoLogin implements RestInterceptor {
  dependsOn = [AuthReadWriteInterceptor];

  @Inject()
  auth: AuthContext;

  applies(route: RouteConfig) {
    return !route.path.endsWith('/body');
  }

  intercept(ctx: FilterContext) {
    this.auth.principal ??= {
      id: Util.uuid(),
      sessionId: Util.uuid(),
      issuedAt: new Date(),
      details: {}
    };
  }
}


@Controller('/test/session')
class TestController {

  @Inject()
  session: SessionService;

  @Get('/')
  get(data: SessionData): SessionData {
    data.age = (data.age ?? 0) + 1;
    return data!;
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
export abstract class AuthRestSessionServerSuite extends BaseRestSuite {

  timeScale = 1;

  @Inject()
  authCfg: AuthConfig;

  @Inject()
  restAuthCfg: RestAuthConfig;

  config({ mode, ...cfg }: { mode: 'cookie' | 'header' } & Partial<AuthConfig>): string {
    Object.assign(this.authCfg, cfg);
    this.restAuthCfg.mode = mode;
    // @ts-expect-error
    this.restAuthCfg.id ??= 0;
    // @ts-expect-error
    this.restAuthCfg.id += 1;
    return this.restAuthCfg[mode].toLowerCase();
  }

  @Test()
  async cookiePersistence() {
    this.config({ maxAgeMs: 10000, mode: 'cookie' });

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
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async cookieNoSession() {
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const cookie = res.headers['set-cookie'];
    assert(cookie === undefined);
  }

  @Test()
  async headerPersistence() {
    const key = this.config({ mode: 'header', rollingRenew: true, maxAge: 3000 });


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

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;
    assert.deepStrictEqual(res.body, { age: 2 });
  }

  @Test()
  async headerComplex() {
    const key = this.config({ mode: 'header', maxAgeMs: 3000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerNoSession() {
    const key = this.config({ mode: 'header', maxAgeMs: 100 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const sessionId = res.headers[key];
    assert(sessionId === undefined);
  }

  @Test()
  async testExpiryHeader() {
    const key = this.config({ mode: 'header', maxAgeMs: 100 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    let header = res.headers[key];
    console.error(res, key, header);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await timers.setTimeout(100 * this.timeScale);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryCookie() {
    this.config({ mode: 'cookie', maxAgeMs: 100 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await timers.setTimeout(100 * this.timeScale);

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryWithExtend() {
    const key = this.config({ mode: 'header', maxAgeMs: 300 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    let header = res.headers[key];

    await timers.setTimeout(50 * this.timeScale);
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    await timers.setTimeout(50 * this.timeScale);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    await timers.setTimeout(50 * this.timeScale);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key] ?? header;

    assert(res.body.payload === payload);
    assert(res.body.age === 3);
  }
}
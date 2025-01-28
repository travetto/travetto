import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Controller, Get, Body, Post, Put, Request, FilterContext, RestInterceptor, RouteConfig } from '@travetto/rest';
import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';

import { SessionData } from '@travetto/auth-session/src/session';
import { AuthContext, Principal } from '@travetto/auth';
import { AuthReadWriteInterceptor, DefaultPrincipalCodec, PrincipalCodec, RestAuthReadWriteConfig } from '@travetto/auth-rest';
import { Config } from '@travetto/config';
import { castTo, TimeUtil, TypedObject, Util } from '@travetto/runtime';
import { SessionService } from '@travetto/auth-session';

type Aged = { age: number, payload?: Record<string, unknown> };

@Config('unknown')
class AuthCodecConfig {
  transport: 'cookie' | 'header' = 'cookie';
  keyName = 'sid';
}

@Injectable()
class AuthorizationCodec extends DefaultPrincipalCodec implements PrincipalCodec {

  cache: Record<string, Principal> = {};

  @Inject()
  authReadwriteConfig: RestAuthReadWriteConfig;

  @Inject()
  cfg: AuthCodecConfig;

  constructor() {
    super({ header: '' });
  }

  postConstruct(): void {
    this.reinit(
      this.cfg.transport === 'header' ?
        { header: this.cfg.keyName, headerPrefix: 'Token' } :
        { cookie: this.cfg.keyName }
    );
  }
}

@Injectable()
class AutoLogin implements RestInterceptor {
  dependsOn = [AuthReadWriteInterceptor];

  @Inject()
  cfg: RestAuthReadWriteConfig;

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
      expiresAt: TimeUtil.fromNow(this.cfg.maxAgeMs),
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
  _config: AuthCodecConfig;

  @Inject()
  _authRw: RestAuthReadWriteConfig;

  @Inject()
  codec: AuthorizationCodec;

  config(opt: Partial<AuthCodecConfig & RestAuthReadWriteConfig>): string {
    for (const k of TypedObject.keys(opt)) {
      if (k === 'transport' || k === 'keyName') {
        this._config[k] = castTo(opt[k]);
      } else {
        this._authRw[k] = castTo(opt[k]);
      }
    }
    this.codec.postConstruct();
    this._authRw.postConstruct();
    return this._config.keyName;
  }

  @Test()
  async cookiePersistence() {
    this.config({ maxAge: 10000, transport: 'cookie' });

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
    this.config({ maxAge: 3000, transport: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async cookieNoSession() {
    this.config({ maxAge: 3000, transport: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const cookie = res.headers['set-cookie'];
    assert(cookie === undefined);
  }

  @Test()
  async headerPersistence() {
    const key = this.config({ transport: 'header', rollingRenew: true, maxAge: 3000 });

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
    const key = this.config({ transport: 'header', maxAge: 3000 });


    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerNoSession() {
    const key = this.config({ transport: 'header', maxAge: 100 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('put', '/test/session/body', { body: payload });
    const sessionId = res.headers[key];
    assert(sessionId === undefined);
  }

  @Test()
  async testExpiryHeader() {
    const key = this.config({ transport: 'header', maxAge: 100 * this.timeScale });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('post', '/test/session/complex', { body: payload });
    let header = res.headers[key];

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
    this.config({ transport: 'cookie', maxAge: 100 * this.timeScale });

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
    const key = this.config({ transport: 'header', maxAge: 300 * this.timeScale });

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
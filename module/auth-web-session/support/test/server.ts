import assert from 'node:assert';
import timers from 'node:timers/promises';

import { AuthConfig, AuthContext } from '@travetto/auth';
import { AuthContextInterceptor, WebAuthConfig } from '@travetto/auth-web';
import { SessionService, SessionData } from '@travetto/auth-session';
import { Inject, Injectable } from '@travetto/di';
import {
  Controller, Get, Body, Post, Put, HttpRequest, HttpInterceptor,
  EndpointConfig, ContextParam, HttpInterceptorCategory, HttpChainedContext
} from '@travetto/web';
import { Util } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { BaseWebSuite } from '@travetto/web/support/test/base.ts';

type Aged = { age: number, payload?: Record<string, unknown> };

@Injectable()
class AutoLogin implements HttpInterceptor {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  auth: AuthContext;

  applies(endpoint: EndpointConfig) {
    return !endpoint.path.endsWith('/body');
  }

  filter({ next }: HttpChainedContext) {
    this.auth.principal ??= {
      id: Util.uuid(),
      sessionId: Util.uuid(),
      issuedAt: new Date(),
      details: {}
    };
    return next();
  }
}


@Controller('/test/session')
class TestController {

  @Inject()
  session: SessionService;

  @ContextParam()
  req: HttpRequest;

  @ContextParam()
  data: SessionData;

  @Get('/')
  get(): SessionData {
    this.data.age = (this.data.age ?? 0) + 1;
    return this.data;
  }

  @Post('/complex')
  withParam(@Body() payload: unknown) {
    this.data.payload = payload;
  }

  @Put('/body')
  withBody() {
    return { body: this.req.body.age };
  }
}

@Suite()
@InjectableSuite()
export abstract class AuthWebSessionServerSuite extends BaseWebSuite {

  @Inject()
  authCfg: AuthConfig;

  @Inject()
  webAuthCfg: WebAuthConfig;

  config({ mode, ...cfg }: { mode: 'cookie' | 'header' } & Partial<AuthConfig>): string {
    Object.assign(this.authCfg, { rollingRenew: true, ...cfg });
    this.webAuthCfg.mode = mode;
    return this.webAuthCfg[mode].toLowerCase();
  }

  @Test()
  async cookiePersistence() {
    this.config({ maxAgeMs: 10000, mode: 'cookie' });

    let res = await this.request<Aged>('GET', '/test/session');
    let cookie = res.headers.get('Set-Cookie');
    assert.deepStrictEqual(res.body, { age: 1 });
    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers.get('Set-Cookie') ?? cookie;
    assert.deepStrictEqual(res.body, { age: 2 });
    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers.get('Set-Cookie') ?? cookie;
    assert.deepStrictEqual(res.body, { age: 3 });
    res = await this.request('GET', '/test/session');
    assert.deepStrictEqual(res.body, { age: 1 });
    cookie = res.headers.get('Set-Cookie') ?? cookie;
    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie } });
    assert.deepStrictEqual(res.body, { age: 2 });
  }

  @Test()
  async cookieComplex() {
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('POST', '/test/session/complex', { body: payload });
    assert(res.status === 201);

    const cookie = res.headers.get('Set-Cookie');
    assert(cookie);
    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async cookieNoSession() {
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('PUT', '/test/session/body', { body: payload });
    assert(res.headers.getSetCookie().length === 0);
  }

  @Test()
  async headerPersistence() {
    const key = this.config({ mode: 'header', rollingRenew: true, maxAgeMs: 3000 });


    let res = await this.request('GET', '/test/session');
    let header = res.headers.get(key);
    assert.deepStrictEqual(res.body, { age: 1 });

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    header = res.headers.get(key) ?? header;
    assert.deepStrictEqual(res.body, { age: 2 });

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    header = res.headers.get(key) ?? header;
    assert.deepStrictEqual(res.body, { age: 3 });

    res = await this.request('GET', '/test/session');
    header = res.headers.get(key) ?? header;
    assert.deepStrictEqual(res.body, { age: 1 });

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    header = res.headers.get(key) ?? header;
    assert.deepStrictEqual(res.body, { age: 2 });
  }

  @Test()
  async headerComplex() {
    const key = this.config({ mode: 'header', maxAgeMs: 3000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('POST', '/test/session/complex', { body: payload });
    assert(res.status === 201);

    const header = res.headers.get(key);
    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerNoSession() {
    const key = this.config({ mode: 'header', maxAgeMs: 100 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const res = await this.request<{ body: number }>('PUT', '/test/session/body', { body: payload });
    assert(!res.headers.has(key));
  }

  @Test()
  async testExpiryHeader() {
    const key = this.config({ mode: 'header', maxAgeMs: 1000 });
    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('POST', '/test/session/complex', { body: payload });
    assert(res.status === 201);

    const start = Date.now();
    let header = res.headers.get(key);
    assert(header);

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    assert(res.status === 200);
    header = res.headers.get(key) ?? header;

    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await timers.setTimeout(1000 - (Date.now() - start));

    res = await this.request('GET', '/test/session', { headers: { [key]: header }, throwOnError: false });
    assert(res.status === 403);


    res = await this.request('GET', '/test/session', {});
    assert(res.status === 200);
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryCookie() {
    this.config({ mode: 'cookie', maxAgeMs: 1000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('POST', '/test/session/complex', { body: payload });
    assert(res.status === 201);
    const start = Date.now();

    const cookie = res.headers.get('Set-Cookie');

    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await timers.setTimeout(1000 - (Date.now() - start));

    res = await this.request('GET', '/test/session', { headers: { Cookie: cookie }, throwOnError: false });
    assert(res.status === 403);

    res = await this.request('GET', '/test/session', { headers: {} });
    assert(res.status === 200);
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryWithExtend() {
    const key = this.config({ mode: 'header', maxAgeMs: 2000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request<Aged>('POST', '/test/session/complex', { body: payload });
    assert(res.status === 201);
    const header = res.headers.get(key);
    await timers.setTimeout(350);

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    assert(res.status === 200);
    assert(res.body.payload === payload);
    assert(!res.headers.has(key));
    await timers.setTimeout(350);

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(!res.headers.has(key));
    await timers.setTimeout(350);

    res = await this.request('GET', '/test/session', { headers: { [key]: header } });
    assert(res.headers.has(key));
    assert(res.body.payload === payload);
    assert(res.body.age === 3);
  }
}
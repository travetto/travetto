import assert from 'node:assert';
import timers from 'node:timers/promises';

import type { AuthConfig, AuthContext } from '@travetto/auth';
import { AuthContextInterceptor, type WebAuthConfig } from '@travetto/auth-web';
import type { SessionService, SessionData } from '@travetto/auth-session';
import { Inject, Injectable } from '@travetto/di';
import {
  Controller, Get, Body, Post, Put, type WebRequest, type WebInterceptor,
  ContextParam, type WebInterceptorCategory, type WebChainedContext, type WebInterceptorContext
} from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

// QUESTION: Explicitly not loading source, maybe we should for the module itself
// Ensure auth-session is loaded
import '../../src/interceptor.ts';

type Aged = { age: number, payload?: Record<string, unknown> };

@Injectable()
class AutoLogin implements WebInterceptor {

  category: WebInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  auth: AuthContext;

  applies({ endpoint }: WebInterceptorContext) {
    return !endpoint.path.endsWith('/body');
  }

  filter({ next }: WebChainedContext) {
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
  request: WebRequest;

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
    return { body: castTo<{ age: number }>(this.request.body).age };
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

    let response = await this.request<Aged>({ context: { httpMethod: 'GET', path: '/test/session' } });
    let cookie = response.headers.get('Set-Cookie');
    assert.deepStrictEqual(response.body, { age: 1 });
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } });
    cookie = response.headers.get('Set-Cookie') ?? cookie;
    assert.deepStrictEqual(response.body, { age: 2 });
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } });
    cookie = response.headers.get('Set-Cookie') ?? cookie;
    assert.deepStrictEqual(response.body, { age: 3 });
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' } });
    assert.deepStrictEqual(response.body, { age: 1 });
    cookie = response.headers.get('Set-Cookie') ?? cookie;
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } });
    assert.deepStrictEqual(response.body, { age: 2 });
  }

  @Test()
  async cookieComplex() {
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let response = await this.request<Aged>({ context: { httpMethod: 'POST', path: '/test/session/complex' }, body: payload });
    assert(response.context.httpStatusCode === 201);

    const cookie = response.headers.get('Set-Cookie');
    assert(cookie);
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } });
    assert(response.body?.payload === payload);
    assert(response.body?.age === 1);
  }

  @Test()
  async cookieNoSession() {
    this.config({ maxAgeMs: 3000, mode: 'cookie' });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const response = await this.request<{ body: number }>({ context: { httpMethod: 'PUT', path: '/test/session/body' }, body: payload });
    assert(response.headers.getSetCookie().length === 0);
  }

  @Test()
  async headerPersistence() {
    const key = this.config({ mode: 'header', rollingRenew: true, maxAgeMs: 3000 });

    let response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' } });
    let header = response.headers.get(key);
    assert.deepStrictEqual(response.body, { age: 1 });

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    header = response.headers.get(key) ?? header;
    assert.deepStrictEqual(response.body, { age: 2 });

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    header = response.headers.get(key) ?? header;
    assert.deepStrictEqual(response.body, { age: 3 });

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' } });
    header = response.headers.get(key) ?? header;
    assert.deepStrictEqual(response.body, { age: 1 });

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert.deepStrictEqual(response.body, { age: 2 });
  }

  @Test()
  async headerComplex() {
    const key = this.config({ mode: 'header', maxAgeMs: 3000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let response = await this.request<Aged>({ context: { httpMethod: 'POST', path: '/test/session/complex' }, body: payload });
    assert(response.context.httpStatusCode === 201);

    const header = response.headers.get(key);
    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert(response.body?.payload === payload);
    assert(response.body?.age === 1);
  }

  @Test()
  async headerNoSession() {
    const key = this.config({ mode: 'header', maxAgeMs: 100 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    const response = await this.request<{ body: number }>({ context: { httpMethod: 'PUT', path: '/test/session/body' }, body: payload });
    assert(!response.headers.has(key));
  }

  @Test()
  async testExpiryHeader() {
    const key = this.config({ mode: 'header', maxAgeMs: 1000 });
    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let response = await this.request<Aged>({ context: { httpMethod: 'POST', path: '/test/session/complex' }, body: payload });
    assert(response.context.httpStatusCode === 201);

    const start = Date.now();
    let header = response.headers.get(key);
    assert(header);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert(response.context.httpStatusCode === 200);
    header = response.headers.get(key) ?? header;

    assert(response.body?.payload === payload);
    assert(response.body?.age === 1);

    await timers.setTimeout(1000 - (Date.now() - start));

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } }, false);
    assert(response.context.httpStatusCode === 403);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' } });
    assert(response.context.httpStatusCode === 200);
    assert(response.body?.payload === undefined);
    assert(response.body?.age === 1);
  }

  @Test()
  async testExpiryCookie() {
    this.config({ mode: 'cookie', maxAgeMs: 1000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let response = await this.request<Aged>({ context: { httpMethod: 'POST', path: '/test/session/complex' }, body: payload });
    assert(response.context.httpStatusCode === 201);
    const start = Date.now();

    const cookie = response.headers.get('Set-Cookie');

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } });
    assert(response.body?.payload === payload);
    assert(response.body?.age === 1);

    await timers.setTimeout(1000 - (Date.now() - start));

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { Cookie: cookie } }, false);
    assert(response.context.httpStatusCode === 403);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: {} });
    assert(response.context.httpStatusCode === 200);
    assert(response.body?.payload === undefined);
    assert(response.body?.age === 1);
  }

  @Test()
  async testExpiryWithExtend() {
    const key = this.config({ mode: 'header', maxAgeMs: 2000 });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let response = await this.request<Aged>({ context: { httpMethod: 'POST', path: '/test/session/complex' }, body: payload });
    assert(response.context.httpStatusCode === 201);
    const header = response.headers.get(key);
    await timers.setTimeout(350);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert(response.context.httpStatusCode === 200);
    assert(response.body?.payload === payload);
    assert(!response.headers.has(key));
    await timers.setTimeout(350);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert(response.body?.payload === payload);
    assert(!response.headers.has(key));
    await timers.setTimeout(350);

    response = await this.request({ context: { httpMethod: 'GET', path: '/test/session' }, headers: { [key]: header } });
    assert(response.headers.has(key));
    assert(response.body?.payload === payload);
    assert(response.body?.age === 3);
  }
}
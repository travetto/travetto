import timers from 'node:timers/promises';
import assert from 'node:assert';

import { Controller, Get, type WebHeaders, WebResponse, Post, type Cookie, CookieJar } from '@travetto/web';
import { Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex, Inject, InjectableFactory } from '@travetto/di';
import { AuthenticationError, type Authenticator, type AuthContext, type AuthConfig } from '@travetto/auth';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

import { Login, Authenticated, Logout } from '../../src/decorator.ts';
import type { WebAuthConfig } from '../../src/config.ts';
import { CommonPrincipalCodecSymbol } from '../../src/types.ts';
import { JWTPrincipalCodec } from '../../src/codec.ts';

const TestAuthSymbol = Symbol.for('TEST_AUTH');

class Config {
  @InjectableFactory(TestAuthSymbol)
  static getAuthenticator(cfg: AuthConfig): Authenticator {
    cfg.rollingRenew = true;
    cfg.maxAgeMs = 2000;

    return {
      async authenticate(body: { username?: string, password?: string }) {
        if (body.username === 'super-user' && body.password === 'password') {
          return {
            id: '5',
            details: { name: 'Billy' },
            permissions: ['perm1', 'perm2'],
            issuer: 'custom',
          };
        }
        throw new AuthenticationError('User unknown');
      }
    };
  }
}

@Controller('/test/auth')
class TestAuthController {

  @Inject()
  authContext: AuthContext;

  @Post('/login')
  @Login(TestAuthSymbol)
  async simpleLogin() {
    console.log('hello');
  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.authContext.principal;
  }

  @Get('/token')
  @Authenticated()
  async getToken() {
    return this.authContext.authToken?.value;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return WebResponse.redirect('/auth/self');
  }
}

@Controller('/test/auth-all')
@Authenticated()
class TestAuthAllController {

  @Inject()
  authContext: AuthContext;

  @Get('/self')
  async getSelf() {
    return this.authContext.principal;
  }
}

@Suite()
@InjectableSuite()
export abstract class AuthWebServerSuite extends BaseWebSuite {

  @Inject()
  config: WebAuthConfig;

  async getCookie(headers: WebHeaders): Promise<Cookie | undefined> {
    const jar = new CookieJar();
    await jar.importSetCookieHeader(headers.getSetCookie());
    return jar.getAll()[0];
  }

  async getCookieHeader(headers: WebHeaders): Promise<string | undefined> {
    const jar = new CookieJar();
    await jar.importSetCookieHeader(headers.getSetCookie());
    return jar.exportCookieHeader();
  }

  async getCookieExpires(headers: WebHeaders): Promise<Date | undefined> {
    const v = (await this.getCookie(headers))?.expires;
    return v ? new Date(v) : undefined;
  }

  @Test()
  async testBadAuth() {
    const { context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'Todd',
        password: 'Rod'
      }
    }, false);
    assert(statusCode === 401);
  }

  @Test()
  async testGoodAuth() {
    this.config.mode = 'cookie';

    const { headers, context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(headers.getSetCookie().length);
    assert(statusCode === 201);
  }

  @Test()
  async testBlockedAuthenticated() {
    this.config.mode = 'header';

    const { context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/self' }
    }, false);
    assert(statusCode === 401);
  }

  @Test()
  async testGoodAuthenticatedCookie() {
    this.config.mode = 'cookie';

    const { headers, context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(statusCode === 201);
    const cookie = await this.getCookieHeader(headers);
    assert(cookie);

    const { context: { httpStatusCode: lastStatus } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/self' },
      headers: { cookie }
    }, false);
    assert(lastStatus === 200);
  }

  @Test()
  async testGoodAuthenticatedHeader() {
    this.config.mode = 'header';

    const { headers, context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(statusCode === 201);

    const { context: { httpStatusCode: lastStatus } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/self' },
      headers: {
        Authorization: headers.get('Authorization')!
      }
    }, false);
    assert(lastStatus === 200);
  }

  @Test()
  async testAllAuthenticated() {
    this.config.mode = 'header';

    const { context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth-all/self' }
    }, false);
    assert(statusCode === 401);

    const { headers, context: { httpStatusCode: authStatus } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(authStatus === 201);

    const { context: { httpStatusCode: lastStatus } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth-all/self' },
      headers: {
        Authorization: headers.get('Authorization')!
      }
    }, false);
    assert(lastStatus === 200);
  }

  @Test()
  async testTokenRetrieval() {
    this.config.mode = 'cookie';

    const { headers, context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(statusCode === 201);
    const cookie = await this.getCookieHeader(headers);
    assert(cookie);

    const { body, context: { httpStatusCode: lastStatus } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/token' },
      headers: { cookie }
    }, false);
    assert(lastStatus === 200);
    assert(typeof body === 'string');

    const codec = await DependencyRegistryIndex.getInstance(JWTPrincipalCodec, CommonPrincipalCodecSymbol);
    await assert.doesNotReject(() => codec.verify(body));
  }

  @Test()
  async testCookieRollingRenewAuthenticated() {
    this.config.mode = 'cookie';

    const { headers, context: { httpStatusCode: statusCode } } = await this.request({
      context: { httpMethod: 'POST', path: '/test/auth/login' },
      body: {
        username: 'super-user',
        password: 'password'
      }
    }, false);
    assert(statusCode === 201);

    const start = Date.now();
    const cookie = await this.getCookieHeader(headers);
    assert(cookie);

    const expires = await this.getCookieExpires(headers);
    assert(expires);

    const { headers: selfHeaders, context: { httpStatusCode: lastStatus } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/self' },
      headers: { cookie }
    }, false);
    assert(await this.getCookie(selfHeaders) === undefined);
    assert(lastStatus === 200);

    const used = (Date.now() - start);
    assert(used < 1000);
    await timers.setTimeout((2000 - used) / 2);

    const { headers: selfHeadersRenew, context: { httpStatusCode: lastStatus2 } } = await this.request({
      context: { httpMethod: 'GET', path: '/test/auth/self' },
      headers: { cookie }
    }, false);
    assert(lastStatus2 === 200);
    assert(await this.getCookie(selfHeadersRenew));

    const expiresRenew = await this.getCookieExpires(selfHeadersRenew);
    assert(expiresRenew);

    const delta = expiresRenew.getTime() - expires.getTime();
    assert(delta < 1800);
    assert(delta > 500);
  }
}
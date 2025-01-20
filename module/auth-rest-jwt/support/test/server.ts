import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Controller, Get, Post, Redirect, Request } from '@travetto/rest';
import { Suite, Test } from '@travetto/test';
import { DependencyRegistry, Inject, InjectableFactory } from '@travetto/di';
import { AuthContextService, AuthenticationError, Authenticator } from '@travetto/auth';
import { Login, Authenticated, Logout } from '@travetto/auth-rest';
import { JWTUtil } from '@travetto/jwt';

import { BaseRestSuite } from '@travetto/rest/support/test/base';

import { RestJWTConfig } from '../../src/principal-encoder';

const TestAuthSymbol = Symbol.for('TEST_AUTH');

class Config {
  @InjectableFactory(TestAuthSymbol)
  static getAuthenticator(): Authenticator {
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
  svc: AuthContextService;

  @Post('/login')
  @Login(TestAuthSymbol)
  async simpleLogin() {
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/token')
  @Authenticated()
  async getToken() {
    return this.svc.getAuthenticationToken()?.token;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return new Redirect('/auth/self', 301);
  }
}

@Controller('/test/auth-all')
@Authenticated()
class TestAuthAllController {

  @Get('/self')
  async getSelf(req: Request) {
    return req.auth;
  }
}

@Suite()
export abstract class AuthRestJWTServerSuite extends BaseRestSuite {

  getCookie(headers: Record<string, string | string[] | undefined>): string | undefined {
    return this.getFirstHeader(headers, 'set-cookie');
  }

  getCookieValue(headers: Record<string, string | string[] | undefined>): string | undefined {
    return this.getCookie(headers)?.split(';')[0];
  }

  getCookieExpires(headers: Record<string, string | string[] | undefined>): Date | undefined {
    const v = this.getCookie(headers)?.match('expires=([^;]+);')?.[1];
    return v ? new Date(v) : undefined;
  }

  @Test()
  async testBadAuth() {
    const { status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'Todd',
        password: 'Rod'
      }
    });
    assert(status === 401);
  }

  @Test()
  async testGoodAuth() {
    const { headers, status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(this.getCookie(headers));
    assert(status === 201);
  }

  @Test()
  async testBlockedAuthenticated() {
    const { status } = await this.request('get', '/test/auth/self', {
      throwOnError: false
    });
    assert(status === 401);
  }

  @Test()
  async testGoodAuthenticated() {
    const { headers, status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);
    const cookie = this.getCookieValue(headers);
    assert(cookie);

    const { status: lastStatus } = await this.request('get', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(lastStatus === 200);
  }

  @Test()
  async testTokenRetrieval() {
    const config = await DependencyRegistry.getInstance(RestJWTConfig);

    const { headers, status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);
    const cookie = this.getCookieValue(headers);
    assert(cookie);

    const { body, status: lastStatus } = await this.request('get', '/test/auth/token', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(lastStatus === 200);
    assert(typeof body === 'string');
    assert(JWTUtil.verify(body, { key: config.signingKey }));
  }

  @Test()
  async testCookieRollingRenewAuthenticated() {
    const { headers, status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);

    const start = Date.now();
    const cookie = this.getCookieValue(headers);
    assert(cookie);

    const expires = this.getCookieExpires(headers);
    assert(expires);

    const { headers: selfHeaders, status: lastStatus } = await this.request('get', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(this.getCookie(selfHeaders) === undefined);
    assert(lastStatus === 200);

    const used = (Date.now() - start);
    assert(used < 1000);
    await timers.setTimeout((2000 - used) / 2);

    const { headers: selfHeadersRenew } = await this.request('get', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(this.getCookie(selfHeadersRenew));

    const expiresRenew = this.getCookieExpires(selfHeadersRenew);
    assert(expiresRenew);

    const delta = expiresRenew.getTime() - expires.getTime();
    assert(delta < 1800);
    assert(delta > 500);
  }
}
import timers from 'node:timers/promises';
import assert from 'node:assert';

import { Controller, Get, HttpHeaders, HttpResponse, Post } from '@travetto/web';
import { Suite, Test } from '@travetto/test';
import { DependencyRegistry, Inject, InjectableFactory } from '@travetto/di';
import { AuthenticationError, Authenticator, AuthContext, AuthConfig } from '@travetto/auth';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { BaseWebSuite } from '@travetto/web/support/test/base.ts';

import { Login, Authenticated, Logout } from '../../src/decorator.ts';
import { WebAuthConfig } from '../../src/config.ts';
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
    return HttpResponse.redirect('/auth/self', 301);
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

  getCookie(headers: HttpHeaders): string | undefined {
    return headers.getSetCookie()[0];
  }

  getCookieValue(headers: HttpHeaders): string | undefined {
    return this.getCookie(headers)?.split(';')[0];
  }

  getCookieExpires(headers: HttpHeaders): Date | undefined {
    const v = this.getCookie(headers)?.match('expires=([^;]+)(;|$)')?.[1];
    return v ? new Date(v) : undefined;
  }

  @Test()
  async testBadAuth() {
    const { status } = await this.request('POST', '/test/auth/login', {
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
    this.config.mode = 'cookie';

    const { headers, status } = await this.request('POST', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(headers.getSetCookie().length);
    assert(status === 201);
  }

  @Test()
  async testBlockedAuthenticated() {
    this.config.mode = 'header';

    const { status } = await this.request('GET', '/test/auth/self', {
      throwOnError: false
    });
    assert(status === 401);
  }

  @Test()
  async testGoodAuthenticatedCookie() {
    this.config.mode = 'cookie';

    const { headers, status } = await this.request('POST', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);
    const cookie = this.getCookieValue(headers);
    assert(cookie);

    const { status: lastStatus } = await this.request('GET', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(lastStatus === 200);
  }

  @Test()
  async testGoodAuthenticatedHeader() {
    this.config.mode = 'header';

    const { headers, status } = await this.request('POST', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);

    const { status: lastStatus } = await this.request('GET', '/test/auth/self', {
      throwOnError: false,
      headers: {
        Authorization: headers.get('Authorization')!
      }
    });
    assert(lastStatus === 200);
  }

  @Test()
  async testAllAuthenticated() {
    this.config.mode = 'header';

    const { status } = await this.request('GET', '/test/auth-all/self', {
      throwOnError: false
    });
    assert(status === 401);

    const { headers, status: authStatus } = await this.request('POST', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(authStatus === 201);


    const { status: lastStatus } = await this.request('GET', '/test/auth-all/self', {
      throwOnError: false,
      headers: {
        Authorization: headers.get('Authorization')!
      }
    });
    assert(lastStatus === 200);
  }


  @Test()
  async testTokenRetrieval() {
    this.config.mode = 'cookie';

    const { headers, status } = await this.request('POST', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);
    const cookie = this.getCookieValue(headers);
    assert(cookie);

    const { body, status: lastStatus } = await this.request('GET', '/test/auth/token', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(lastStatus === 200);
    assert(typeof body === 'string');

    const codec = await DependencyRegistry.getInstance(JWTPrincipalCodec, CommonPrincipalCodecSymbol);
    await assert.doesNotReject(() => codec.verify(body));
  }

  @Test()
  async testCookieRollingRenewAuthenticated() {
    this.config.mode = 'cookie';

    const { headers, status } = await this.request('POST', '/test/auth/login', {
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

    const { headers: selfHeaders, status: lastStatus } = await this.request('GET', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(this.getCookie(selfHeaders) === undefined);
    assert(lastStatus === 200);

    const used = (Date.now() - start);
    assert(used < 1000);
    await timers.setTimeout((2000 - used) / 2);

    const { headers: selfHeadersRenew, status: lastStatus2 } = await this.request('GET', '/test/auth/self', {
      throwOnError: false,
      headers: { cookie }
    });
    assert(lastStatus2 === 200);
    assert(this.getCookie(selfHeadersRenew));

    const expiresRenew = this.getCookieExpires(selfHeadersRenew);
    assert(expiresRenew);

    const delta = expiresRenew.getTime() - expires.getTime();
    assert(delta < 1800);
    assert(delta > 500);
  }
}
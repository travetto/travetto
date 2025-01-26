import assert from 'node:assert';

import { Controller, FilterContext, Get, Post, Redirect, RestCodecValue } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { Suite, Test } from '@travetto/test';
import { Inject, Injectable, InjectableFactory } from '@travetto/di';
import { AuthenticationError, Authenticator, AuthContext, Principal } from '@travetto/auth';

import { Login, Authenticated, Logout } from '../../src/decorator';
import { PrincipalCodec } from '../../src/codec';

const TestAuthSymbol = Symbol.for('TEST_AUTH');

@Injectable({ primary: true })
class AuthorizationCodec implements PrincipalCodec {

  value = new RestCodecValue({ header: 'Authorization', headerPrefix: 'Token' });

  encode({ res }: FilterContext, p: Principal | undefined) {
    if (p) {
      this.value.writeValue(res, Buffer.from(JSON.stringify(p)).toString('base64'));
    }
  }
  decode({ req }: FilterContext): Principal | undefined {
    try {
      const v = this.value.readValue(req);
      if (v) {
        return JSON.parse(Buffer.from(v, 'base64').toString('utf8'));
      }
    } catch { }
  }
}

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
  authContext: AuthContext;

  @Post('/login')
  @Login(TestAuthSymbol)
  async simpleLogin() {
  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.authContext.principal;
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

  @Inject()
  authContext: AuthContext;

  @Get('/self')
  async getSelf() {
    return this.authContext.principal;
  }
}

@Suite()
export abstract class AuthRestServerSuite extends BaseRestSuite {

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
    const { status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
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

    const { status: lastStatus } = await this.request('get', '/test/auth/self', {
      throwOnError: false,
      headers: {
        Authorization: headers.authorization
      }
    });
    assert(lastStatus === 200);
  }

  @Test()
  async testAllAuthenticated() {
    const { status } = await this.request('get', '/test/auth-all/self', {
      throwOnError: false
    });
    assert(status === 401);

    const { headers, status: authStatus } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(authStatus === 201);

    const { status: lastStatus } = await this.request('get', '/test/auth-all/self', {
      throwOnError: false,
      headers: {
        Authorization: headers.authorization
      }
    });
    assert(lastStatus === 200);
  }
}
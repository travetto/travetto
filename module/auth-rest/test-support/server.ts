import * as assert from 'assert';

import { Controller, Get, Post, Redirect, Request, Response } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/test-support/base';
import { Suite, Test } from '@travetto/test';
import { Injectable, InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/base';
import { AuthContext } from '@travetto/auth/src/context';

import { Authenticate, Authenticated } from '../src/decorator';
import { IdentitySource } from '../src/identity';
import { AuthContextEncoder } from '../src/encoder';

const TestAuthSym = Symbol.for('TEST_AUTH');

@Injectable({
  primary: true
})
class AuthorizationEncoder implements AuthContextEncoder {
  async encode(req: Request, res: Response, ctx: AuthContext) {
    const value = JSON.stringify({ principal: ctx.principal, identity: ctx.identity });
    res.setHeader('Authorization', Buffer.from(value).toString('base64'));
  }
  async decode(req: Request) {
    try {
      if (req.headers.authorization) {
        const config = JSON.parse(Buffer.from(req.headers.authorization as string, 'base64').toString('utf8'));
        if (config.identity && config.principal) {
          return new AuthContext(config.identity, config.principal);
        }
      }
    } catch { }
  }
}

class Config {
  @InjectableFactory(TestAuthSym)
  static getAuthenticator(): IdentitySource {
    return {
      async authenticate(req: Request) {
        if (req.body.username === 'super-user' && req.body.password === 'password') {
          return {
            id: '5',
            details: { name: 'Billy' },
            permissions: ['perm1', 'perm2'],
            issuer: 'custom',
          };
        }
        throw new AppError('User unknown', 'authentication');
      }
    };
  }
}

@Controller('/test/auth')
class TestAuthController {

  @Post('/login')
  @Authenticate(TestAuthSym)
  async simpleLogin() {
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth?.principal;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}

@Controller('/test/auth-all')
@Authenticated()
class TestAuthAllController {

  @Get('/self')
  async getSelf(req: Request) {
    return req.auth?.principal;
  }
}

@Suite()
export abstract class AuthRestServerSuite extends BaseRestSuite {

  @Test()
  async testBadAuth() {
    const { status } = await this.request('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'todd',
        password: 'rodd'
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
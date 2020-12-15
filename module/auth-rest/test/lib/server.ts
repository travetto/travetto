import * as assert from 'assert';

import { Controller, Get, Post, Redirect, Request, Response } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/test/lib/base';
import { AfterAll, BeforeAll, Suite, Test } from '@travetto/test';
import { Injectable, InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/base';
import { AuthContext } from '@travetto/auth/src/context';

import { Authenticate, Authenticated } from '../../src/decorator';
import { IdentitySource } from '../../src/identity';
import { AuthContextEncoder } from '../../src/encoder';

const TEST_AUTH = Symbol.for('TEST_AUTH');


@Injectable({
  primary: true
})
class AuthorizationEncoder implements AuthContextEncoder {
  async encode(req: Request, res: Response, ctx: AuthContext) {
    const value = Buffer
      .from(JSON.stringify({ principal: ctx.principal, identity: ctx.identity }))
      .toString('base64');
    res.setHeader('Authorization', value);
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
  @InjectableFactory(TEST_AUTH)
  static getAuthenticator(): IdentitySource {
    return new class implements IdentitySource {
      async authenticate(req: Request) {
        if (req.body.username === 'super-user' && req.body.password === 'password') {
          return {
            id: '5',
            details: { name: 'Billy' },
            permissions: ['perm1', 'perm2'],
            source: 'custom',
          };
        }
        throw new AppError('User unknown', 'authentication');
      }
    }();
  }
}

@Controller('/test/auth')
class TestAuthController {

  @Post('/login')
  @Authenticate(TEST_AUTH)
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

@Suite({ skip: true })
export abstract class AuthRestServerSuite extends BaseRestSuite {

  @BeforeAll()
  async before() { return this.initServer(); }

  @AfterAll()
  async after() { return this.destroySever(); }

  @Test()
  async testBadAuth() {
    const { status } = await this.makeRequst('post', '/test/auth/login', {
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
    const { headers, status } = await this.makeRequst('post', '/test/auth/login', {
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
    const { status } = await this.makeRequst('get', '/test/auth/self', {
      throwOnError: false
    });
    assert(status === 401);
  }

  @Test()
  async testGoodAuthenticated() {
    const { headers, status } = await this.makeRequst('post', '/test/auth/login', {
      throwOnError: false,
      body: {
        username: 'super-user',
        password: 'password'
      }
    });
    assert(status === 201);

    const { status: lastStatus } = await this.makeRequst('get', '/test/auth/self', {
      throwOnError: false,
      headers: {
        Authorization: headers.authorization
      }
    });
    assert(lastStatus === 200);
  }
}
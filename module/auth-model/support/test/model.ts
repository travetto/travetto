import assert from 'node:assert';

import { RuntimeError, castTo, type Class } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { type ModelCrudSupport, Model, Transient } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';

import { ModelAuthService, type RegisteredPrincipal } from '../../src/model.ts';

export const TestModelSvcSymbol = Symbol.for('@travetto/auth:test-model-svc');

@Model({ autoCreate: 'production' })
class User implements RegisteredPrincipal {
  id: string;
  @Transient()
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
  details: Record<string, unknown>;
}

class TestConfig {
  @InjectableFactory()
  static getAuthService(@Inject(TestModelSvcSymbol) svc: ModelCrudSupport): ModelAuthService<User> {
    const src = new ModelAuthService<User>(
      svc,
      User,
      u => castTo({ ...u, details: u, source: 'model' }),
      reg => User.from({ ...reg })
    );
    return src;
  }
}

@Suite()
@ModelSuite()
@InjectableSuite()
export abstract class AuthModelServiceSuite {

  serviceClass: Class;
  configClass: Class;

  @Inject()
  authService: ModelAuthService<User>;

  @Inject(TestModelSvcSymbol)
  svc: ModelCrudSupport;

  @Test()
  async register() {
    const pre = User.from({
      password: 'bob',
      details: {}
    });

    const user = await this.authService.register(pre);
    assert(user.password === undefined);
    assert.ok(user.hash);
    assert.ok(user.id);
  }

  @Test()
  async authenticate() {
    const pre = User.from({
      id: this.svc.idSource.create(),
      password: 'bob',
      details: {}
    });

    try {
      await this.authService.authenticate(pre);
      assert.fail('Should not have gotten here');
    } catch (err) {
      if (err instanceof RuntimeError && err.category === 'notfound') {
        const user = await this.authService.register(pre);
        assert.ok(user.hash);
        assert.ok(user.id);
        assert(user.password === undefined);
      } else {
        throw err;
      }
    }

    await assert.doesNotReject(() => this.authService.authenticate(pre));
  }
}
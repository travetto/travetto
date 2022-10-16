import * as assert from 'assert';

import { AppError, Class } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelCrudSupport, Model } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/support/test.suite';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { ModelAuthService, RegisteredPrincipal } from '../src/model';

export const TestModelSvcⲐ = Symbol.for('@trv:auth/test-model-svc');

@Model({ autoCreate: false })
class User implements RegisteredPrincipal {
  id: string;
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
  static getAuthService(@Inject(TestModelSvcⲐ) svc: ModelCrudSupport): ModelAuthService<User> {
    const src = new ModelAuthService<User>(
      svc,
      User,
      u => ({ ...u, details: u, source: 'model' }),
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

  @Inject(TestModelSvcⲐ)
  svc: ModelCrudSupport;

  @Test()
  async register() {
    const pre = User.from({
      password: 'bob',
      details: {}
    });

    const user = await this.authService.register(pre);
    assert.ok(user.hash);
    assert.ok(user.id);
  }

  @Test()
  async authenticate() {
    const pre = User.from({
      id: this.svc.uuid(),
      password: 'bob',
      details: {}
    });

    try {
      await this.authService.authenticate(pre);
      assert.fail('Should not have gotten here');
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        const user = await this.authService.register(pre);
        assert.ok(user.hash);
        assert.ok(user.id);
      } else {
        throw err;
      }
    }

    await assert.doesNotReject(() => this.authService.authenticate(pre));
  }
}
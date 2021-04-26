// @file-if @travetto/model
import * as assert from 'assert';

import { AppError, Class } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelCrudSupport, BaseModel, Model } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/test-support/suite';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { ModelAuthService, RegisteredPrincipal } from '..';

export const TestModelSvcⲐ = Symbol.for('@trv:auth/test-model-svc');

@Model({ autoCreate: false })
class User extends BaseModel implements RegisteredPrincipal {
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
}

class TestConfig {
  @InjectableFactory()
  static getauthService(@Inject(TestModelSvcⲐ) svc: ModelCrudSupport): ModelAuthService<User> {
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

  @Test()
  async register() {
    const pre = User.from({
      password: 'bob'
    });

    const user = await this.authService.register(pre);
    assert.ok(user.hash);
    assert.ok(user.id);
  }

  @Test()
  async authenticate() {
    const pre = User.from({
      id: '5',
      password: 'bob'
    });

    console.log(pre);

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
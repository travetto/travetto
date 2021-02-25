import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { DependencyRegistry, Inject, InjectableFactory } from '@travetto/di';
import { ModelCrudSupport, BaseModel, Model } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/test-support/base';

import { ModelPrincipalSource, RegisteredIdentity } from '..';

export const TestModelSvcSym = Symbol.for('@trv:auth-model/test-model-svc');

@Model({ autoCreate: false })
class User extends BaseModel {
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
}

class TestConfig {
  @InjectableFactory()
  static getPrincipalSource(@Inject(TestModelSvcSym) svc: ModelCrudSupport): ModelPrincipalSource<User> {
    const src = new ModelPrincipalSource<User>(
      svc,
      User,
      (u) => ({
        ...(u as unknown as RegisteredIdentity),
        details: u,
        permissions: u.permissions ?? [],
        source: 'model'
      }),
      (registered) => User.from({
        ...(registered as User)
      })
    );
    return src;
  }
}

@Suite()
export abstract class AuthModelServiceSuite extends BaseModelSuite<ModelCrudSupport> {

  get principalSource() {
    return DependencyRegistry.getInstance<ModelPrincipalSource<User>>(ModelPrincipalSource);
  }

  @Test()
  async register() {
    const svc = await this.principalSource;

    const pre = User.from({
      password: 'bob'
    });

    const user = await svc.register(pre);
    assert.ok(user.hash);
    assert.ok(user.id);
  }

  @Test()
  async authenticate() {
    const svc = await this.principalSource;

    const pre = User.from({
      id: '5',
      password: 'bob'
    });

    try {
      await svc.authenticate(pre.id, pre.password!);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        const user = await svc.register(pre);
        assert.ok(user.hash);
        assert.ok(user.id);
      } else {
        throw err;
      }
    }

    await assert.doesNotReject(() => svc.authenticate(pre.id, pre.password!));
  }
}
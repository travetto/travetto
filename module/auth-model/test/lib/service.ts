import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { BaseModelSuite } from '@travetto/model-core/test/lib/test.base';
import { ModelCrudSupport, BaseModel, Model } from '@travetto/model-core';

import { ModelPrincipalSource, RegisteredIdentity } from '../..';
import { AuthModelSymbol } from '../../src/principal';

@Model({
  for: AuthModelSymbol
})
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
  static getAuthService(): ModelPrincipalSource<User> {
    return new ModelPrincipalSource<User>(
      User,
      (u) => ({
        ...(u as any as RegisteredIdentity),
        details: u,
        permissions: u.permissions ?? [],
        source: 'model'
      }),
      (registered) => User.from({
        ...(registered as User)
      })
    );
  }
}

@Suite({ skip: true })
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
      await svc.authenticate(pre.id!, pre.password!);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        const user = await svc.register(pre);
        assert.ok(user.hash);
        assert.ok(user.id);
      } else {
        throw err;
      }
    }

    await assert.doesNotReject(() => svc.authenticate(pre.id!, pre.password!));
  }
}
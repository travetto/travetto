import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory, Injectable } from '@travetto/di';
import { BaseModel, Model, ModelSource } from '@travetto/model'; // Auto imports the registry

import { ModelPrincipalSource, RegisteredIdentity } from '../';

@Model()
class User extends BaseModel {
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
}

@Injectable({ target: ModelSource })
class MockModelSource {
  private users: User[] = [];
  private ids: number = 0;

  async getAllByQuery(cls: User, q: any) {
    const res = this.users.filter(u => u.id === q.where.id);
    return res;
  }

  async getByQuery(cls: User, q: any) {
    const res = this.users.find(v => q.where.id === v.id);
    if (!res) {
      throw new AppError('Unable to find user', 'notfound');
    }
    return res;
  }

  async save(cls: User, u: User) {
    if (!u.id) {
      u.id = `${this.ids++}`;
    }
    this.users.push(u);
    return u;
  }

  prePersist(...args: any[]) {
    return args[1];
  }

  postLoad(...args: any[]) {
    return args[1];
  }
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

@Suite()
export class ServiceTest {
  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async register() {
    const svc = await DependencyRegistry.getInstance<ModelPrincipalSource<User>>(ModelPrincipalSource);
    assert.ok(svc);

    const pre = User.from({
      password: 'bob'
    });

    const user = await svc.register(pre);
    assert.ok(user.hash);
    assert.ok(user.id);
  }

  @Test()
  async authenticate() {
    const svc = await DependencyRegistry.getInstance<ModelPrincipalSource<User>>(ModelPrincipalSource);
    assert.ok(svc);

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
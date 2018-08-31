import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory, Injectable } from '@travetto/di';
import { ModelRegistry, BaseModel, Model, ModelSource, ModelService } from '@travetto/model';
import { AuthModelService, RegisteredPrincipalConfig } from '../';
import { SchemaRegistry } from '@travetto/schema';

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

  async getAllByQuery(...args: any[]) {
    return this.users;
  }

  async save(u: User) {
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
  static getAuthService(service: ModelService): AuthModelService<User> {
    return new AuthModelService<User>(
      service, new RegisteredPrincipalConfig(User, {
        id: 'id',
        password: 'password',
        permissions: 'permissions',
        hash: 'hash',
        salt: 'salt',
        resetExpires: 'resetExpires',
        resetToken: 'resetToken'
      })
    );
  }
}

@Suite()
export class ServiceTest {
  @BeforeAll()
  async init() {
    await ModelRegistry.init();
    await SchemaRegistry.init();
    await DependencyRegistry.init();
  }

  @Test()
  async register() {
    const svc: AuthModelService<User> = await DependencyRegistry.getInstance(AuthModelService);
    assert.ok(svc);

    const pre = User.from({
      password: 'bob'
    });

    const user = await svc.register(pre);
    assert(user.hash === undefined);
    assert.ok(user.id);
  }
}
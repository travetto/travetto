import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema, View } from '../src/decorator/schema';
import { SchemaRegistry } from '../src/service/registry';

@Schema()
class BaseAccount {
  id: string;
  created: Date;
}

@Schema()
@View('secure', { without: ['password'] })
@View('auth', { with: ['email', 'password'] })
class UserAccount extends BaseAccount {
  name: string;
  email: string;
  age: number;
  password: string;
}

@Suite()
export class ViewsTest {

  @BeforeAll()
  ready() {
    return SchemaRegistry.init();
  }

  @Test()
  async testWith() {

    const user = UserAccount.from({
      name: 'bob',
      email: 'bob@bob.com',
      age: 20,
      password: 'b0b',
      id: '5'
    });

    assert.ok(user.name);
    assert.ok(user.email);
    assert.ok(user.age);
    assert.ok(user.password);
    assert.ok(user.id);

    const auth = UserAccount.from({
      name: 'bob',
      email: 'bob@bob.com',
      age: 20,
      password: 'b0b',
      id: '6'
    }, 'auth');

    assert.ok(!auth.name);
    assert.ok(auth.email);
    assert.ok(!auth.age);
    assert.ok(auth.password);
    assert.ok(!auth.id);
  }

  @Test()
  async testWithOut() {
    const auth = UserAccount.from({
      name: 'bob',
      email: 'bob@bob.com',
      age: 20,
      password: 'b0b',
      id: '7'
    }, 'secure');

    assert.ok(auth.name);
    assert.ok(auth.email);
    assert.ok(auth.age);
    assert.ok(!auth.password);
    assert.ok(auth.id);

  }
}
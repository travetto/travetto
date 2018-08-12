import * as assert from 'assert';

import { ModelService } from '@travetto/model';
import { ModelMongoSource } from '@travetto/model-mongo';
import { DependencyRegistry } from '@travetto/di';
import { Test, Suite, BeforeAll, AfterAll } from '@travetto/test';

import { User } from '../../src/model/user';
import { UserService } from '../../src/service/user';
import { RootRegistry } from '@travetto/registry';
import { Context, WithContext } from '@travetto/context';
import { TEST } from './config';

@Suite('User Services')
class UserServiceTest {

  context: Context;

  @BeforeAll()
  async init() {
    console.log('here');
    await RootRegistry.init();
    await DependencyRegistry.init();
    this.context = await DependencyRegistry.getInstance(Context);
  }

  @AfterAll()
  async destroy() {
    const svc = await DependencyRegistry.getInstance(ModelService, TEST);
    const db = (svc as any).source as ModelMongoSource;
    await db.resetDatabase();
  }

  @Test('Delete a user')
  async removeUser() {
    // TODO
    const svc = await DependencyRegistry.getInstance(ModelService, TEST);

    let user = User.from({
      email: 'user@test.com',
      firstName: 'First',
      lastName: 'Last',
      phone: '555-867-5309',
      password: 'test-password',
      permissions: ['a', 'b']
    });

    user = await svc.save(User, user);
    assert.ok(user.id);

    const lookupFound = await svc.getAllByQuery(User, {
      where: { id: user.id }
    });
    assert(lookupFound.length === 1);

    svc.deleteById(User, user.id!);

    const lookupMissing = await svc.getAllByQuery(User, {
      where: { id: user.id }
    });
    assert(lookupMissing.length === 0);
  }

  @Test('Register a user')
  @WithContext({
    user: {
      firstName: 'bob',
      email: 'bob@bob.com'
    }
  })
  async register() {
    let start = Date.now();
    const stamp = () => { console.log(`Delta: ${Date.now() - start}`); start = Date.now(); };
    const userService = await DependencyRegistry.getInstance(UserService, TEST);
    stamp();

    const user: User = User.from({
      firstName: 'Test',
      lastName: 'User',
      email: 'ops@eaiti.com',
      password: 'testpw',
      phone: '5713064683',
      permissions: ['none'],
      address: {
        street1: '1945 Old Gallows RD',
        street2: 'STE 133',
        city: 'Vienna',
        zip: '22182',
        stateOrProvince: 'VA',
        country: 'USA'
      }
    });
    stamp();

    const emptyUser: User = new User();
    emptyUser.email = user.email;
    const res = await userService.register(user);
    stamp();

    assert(res.id !== null);
    delete res.id;
    assert.deepEqual(user, res);
    assert(user.id === undefined);

    try {
      const res2 = await userService.register(emptyUser);
      assert(res2 === null);
    } catch (e) {
      assert(e.message === 'That email is already taken.');
    }
    stamp();
  }
}
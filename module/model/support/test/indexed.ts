import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { TimeUtil } from '@travetto/base';

import { Index, Model } from '../../src/registry/decorator';
import { ModelIndexedSupport } from '../../src/service/indexed';
import { NotFoundError } from '../../src/error/not-found';
import { IndexNotSupported } from '../../src/error/invalid-index';

import { BaseModelSuite } from './base';

@Model('index_user')
@Index({
  name: 'userName',
  type: 'unsorted',
  fields: [{ name: 1 }]
})
class User {
  id: string;
  name: string;
}

@Model('index_user_2')
class User2 {
  id: string;
  name: string;
}

@Model()
@Index({ type: 'sorted', name: 'userAge', fields: [{ name: 1 }, { age: 1 }] })
class User3 {
  id: string;
  name: string;
  age: number;
  color?: string;
}

@Schema()
class Child {
  name: string;
  age: number;
}

@Model()
@Index({ type: 'sorted', name: 'childAge', fields: [{ child: { name: 1 } }, { child: { age: 1 } }] })
@Index({ type: 'sorted', name: 'nameCreated', fields: [{ child: { name: 1 } }, { createdDate: 1 }] })
class User4 {
  id: string;
  createdDate?: Date = new Date();
  color: string;
  child: Child;
}

@Suite()
export abstract class ModelIndexedSuite extends BaseModelSuite<ModelIndexedSupport> {
  @Test()
  async writeAndRead() {
    const service = await this.service;

    await service.create(User, User.from({ name: 'bob1' }));
    await service.create(User, User.from({ name: 'bob2' }));

    const found1 = await service.getByIndex(User, 'userName', {
      name: 'bob1'
    });

    assert(found1.name === 'bob1');

    const found2 = await service.getByIndex(User, 'userName', {
      name: 'bob2'
    });

    assert(found2.name === 'bob2');
  }

  @Test()
  async readMissingIndex() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User, 'missing', {}), NotFoundError);
  }

  @Test()
  async readMissingValue() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User, 'userName', { name: 'jim' }), NotFoundError);
  }

  @Test()
  async readDifferentType() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User2, 'userName', { name: 'jim' }), NotFoundError);
  }

  @Test()
  async queryMultiple() {
    const service = await this.service;

    await service.create(User3, User3.from({ name: 'bob', age: 20 }));
    await service.create(User3, User3.from({ name: 'bob', age: 30, color: 'green' }));

    const found = await service.getByIndex(User3, 'userAge', { name: 'bob', age: 30 });

    assert(found.color === 'green');

    const found2 = await service.getByIndex(User3, 'userAge', { name: 'bob', age: 20 });

    assert(!found2.color);

    await assert.rejects(() => service.getByIndex(User3, 'userAge', { name: 'bob' }));
  }


  @Test()
  async queryList() {
    const service = await this.service;

    await service.create(User3, User3.from({ name: 'bob', age: 40, color: 'blue' }));
    await service.create(User3, User3.from({ name: 'bob', age: 30, color: 'red' }));
    await service.create(User3, User3.from({ name: 'bob', age: 50, color: 'green' }));

    const arr = await this.toArray(service.listByIndex(User3, 'userAge', { name: 'bob' }));

    assert(arr[0].color === 'red' && arr[0].name === 'bob');
    assert(arr[1].color === 'blue' && arr[1].name === 'bob');
    assert(arr[2].color === 'green' && arr[2].name === 'bob');

    await assert.rejects(() => this.toArray(service.listByIndex(User3, 'userAge', {})), IndexNotSupported);
  }

  @Test()
  async queryDeepList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, color: 'green' }));

    const arr = await this.toArray(service.listByIndex(User4, 'childAge', User4.from({ child: { name: 'bob' } })));
    assert(arr[0].color === 'red' && arr[0].child.name === 'bob' && arr[0].child.age === 30);
    assert(arr[1].color === 'blue' && arr[1].child.name === 'bob' && arr[1].child.age === 40);
    assert(arr[2].color === 'green' && arr[2].child.name === 'bob' && arr[2].child.age === 50);

    await assert.rejects(() => this.toArray(service.listByIndex(User4, 'childAge', {})), IndexNotSupported);
  }

  @Test()
  async queryComplexDateList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, createdDate: TimeUtil.timeFromNow('3d'), color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, createdDate: TimeUtil.timeFromNow('2d'), color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, createdDate: TimeUtil.timeFromNow('-1d'), color: 'green' }));

    const arr = await this.toArray(service.listByIndex(User4, 'nameCreated', { child: { name: 'bob' } }));

    assert(arr[0].color === 'green' && arr[0].child.name === 'bob' && arr[0].child.age === 50);
    assert(arr[1].color === 'red' && arr[1].child.name === 'bob' && arr[1].child.age === 30);
    assert(arr[2].color === 'blue' && arr[2].child.name === 'bob' && arr[2].child.age === 40);

    await assert.rejects(() => this.toArray(service.listByIndex(User4, 'nameCreated', {})), IndexNotSupported);
  }

  @Test()
  async upsertByIndex() {
    const service = await this.service;

    const user1 = await service.upsertByIndex(User4, 'childAge', { child: { name: 'bob', age: 40 }, color: 'blue' });
    const user2 = await service.upsertByIndex(User4, 'childAge', { child: { name: 'bob', age: 40 }, color: 'green' });
    const user3 = await service.upsertByIndex(User4, 'childAge', { child: { name: 'bob', age: 40 }, color: 'red' });

    const arr = await this.toArray(service.listByIndex(User4, 'childAge', { child: { name: 'bob' } }));
    assert(arr.length === 1);

    assert(user1.id === user2.id);
    assert(user2.id === user3.id);
    assert(user1.color === 'blue');
    assert(user3.color === 'red');

    const user4 = await service.upsertByIndex(User4, 'childAge', { child: { name: 'bob', age: 30 }, color: 'red' });
    const arr2 = await this.toArray(service.listByIndex(User4, 'childAge', { child: { name: 'bob' } }));
    assert(arr2.length === 2);

    await service.deleteByIndex(User4, 'childAge', user1);

    const arr3 = await this.toArray(service.listByIndex(User4, 'childAge', { child: { name: 'bob' } }));
    assert(arr3.length === 1);
    assert(arr3[0].id === user4.id);
  }
}
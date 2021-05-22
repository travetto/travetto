import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { Util } from '@travetto/base';

import { Index, Model } from '../src/registry/decorator';
import { ModelIndexedSupport } from '../src/service/indexed';
import { BaseModelSuite } from './base';
import { NotFoundError } from '../src/error/not-found';
import { IndexNotSupported } from '../src/error/invalid-index';

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
  createdDate?: Date;
  color: string;
  child: Child;

  prePersist() {
    this.createdDate ??= new Date();
  }
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

    const arr = await service.listByIndex(User3, 'userAge', { name: 'bob' }).toArray();

    assert(arr[0].color === 'red' && arr[0].name === 'bob');
    assert(arr[1].color === 'blue' && arr[1].name === 'bob');
    assert(arr[2].color === 'green' && arr[2].name === 'bob');

    await assert.rejects(() => service.listByIndex(User3, 'userAge', {}).toArray(), IndexNotSupported);
  }

  @Test()
  async queryDeepList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, color: 'green' }));

    const arr = await service.listByIndex(User4, 'childAge', User4.from({ child: { name: 'bob' } })).toArray();
    assert(arr[0].color === 'red' && arr[0].child.name === 'bob' && arr[0].child.age === 30);
    assert(arr[1].color === 'blue' && arr[1].child.name === 'bob' && arr[1].child.age === 40);
    assert(arr[2].color === 'green' && arr[2].child.name === 'bob' && arr[2].child.age === 50);

    await assert.rejects(() => service.listByIndex(User4, 'childAge', {}).toArray(), IndexNotSupported);
  }

  @Test()
  async queryComplexDateList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, createdDate: Util.timeFromNow('3d'), color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, createdDate: Util.timeFromNow('2d'), color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, createdDate: Util.timeFromNow('-1d'), color: 'green' }));

    const arr = await service.listByIndex(User4, 'nameCreated', User4.from({ child: { name: 'bob' } })).toArray();
    console.log(arr);

    assert(arr[0].color === 'green' && arr[0].child.name === 'bob' && arr[0].child.age === 50);
    assert(arr[1].color === 'red' && arr[1].child.name === 'bob' && arr[1].child.age === 30);
    assert(arr[2].color === 'blue' && arr[2].child.name === 'bob' && arr[2].child.age === 40);

    await assert.rejects(() => service.listByIndex(User4, 'nameCreated', {}).toArray(), IndexNotSupported);
  }
}
import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { castTo, TimeUtil } from '@travetto/runtime';
import { Model, NotFoundError } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelIndexedSupport } from '../../src/types/service.ts';
import { keyedIndex, sortedIndex } from '../../src/indexes.ts';
import { IndexedFieldError } from '../../src/types/error.ts';

@Model('index_user')
class User {
  id: string;
  name: string;
}

const userNameIndex = keyedIndex(User, {
  name: 'userName',
  key: { name: true }
});

@Model('index_user_2')
class User2 {
  id: string;
  name: string;
}

@Model()
class User3 {
  id: string;
  name: string;
  age: number;
  color?: string;
}

const userAgeIndex = sortedIndex(User3, {
  name: 'userAge',
  key: { name: true },
  sort: { age: 1 }
});
const userAgeReversedIndex = sortedIndex(User3, {
  name: 'userAgeReverse',
  key: { name: true },
  sort: { age: -1 }
});
const userAgeNoKeyIndex = sortedIndex(User3, {
  name: 'userAgeNoKey',
  key: {},
  sort: { age: 1 }
});

@Schema()
class Child {
  name: string;
  age: number;
}

@Model()
class User4 {
  id: string;
  createdDate?: Date = new Date();
  color: string;
  child: Child;
}

const childAgeIndex = sortedIndex(User4, {
  name: 'childAge',
  key: { child: { name: true } },
  sort: { child: { age: 1 } }
});
const nameCreatedIndex = sortedIndex(User4, {
  name: 'nameCreated',
  key: { child: { name: true } },
  sort: { createdDate: 1 }
});

@Suite()
export abstract class ModelIndexedSuite extends BaseModelSuite<ModelIndexedSupport> {

  indexLimitSkew = 0;
  supportsDeepIndexes = true;

  @Test()
  async writeAndRead() {
    const service = await this.service;

    await service.create(User, User.from({ name: 'bob1' }));
    await service.create(User, User.from({ name: 'bob2' }));

    const found1 = await service.getByIndex(User, userNameIndex, {
      name: 'bob1'
    });

    assert(found1.name === 'bob1');

    const found2 = await service.getByIndex(User, userNameIndex, {
      name: 'bob2'
    });

    assert(found2.name === 'bob2');
  }

  @Test()
  async readByKeyedIndexUsingId() {
    const service = await this.service;

    const first = await service.create(User, User.from({ name: 'sam' }));
    const second = await service.create(User, User.from({ name: 'bob' }));

    const found = await service.getByIndex(User, userNameIndex, {
      name: 'bob',
      id: second.id
    });

    assert(found.id === second.id);

    await assert.rejects(
      () => service.getByIndex(User, userNameIndex, { name: 'bob', id: first.id }),
      NotFoundError
    );

    await service.deleteByIndex(User, userNameIndex, { name: 'sam', id: first.id });

    await assert.rejects(() => service.get(User, first.id), NotFoundError);

    const remaining = await service.getByIndex(User, userNameIndex, { name: 'bob', id: second.id });
    assert(remaining.id === second.id);
  }

  @Test()
  async readMissingValue() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User, userNameIndex, { name: 'jim' }), NotFoundError);
  }

  @Test()
  async readDifferentType() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User2, userNameIndex, { name: 'jim' }), NotFoundError);
  }

  @Test()
  async queryMultiple() {
    const service = await this.service;

    await service.create(User3, User3.from({ name: 'bob', age: 20 }));
    await service.create(User3, User3.from({ name: 'bob', age: 30, color: 'green' }));

    const found = await service.getByIndex(User3, userAgeIndex, { name: 'bob', age: 30 });

    assert(found.color === 'green');

    const found2 = await service.getByIndex(User3, userAgeIndex, { name: 'bob', age: 20 });

    assert(!found2.color);

    // @ts-expect-error
    await assert.rejects(() => service.getByIndex(User3, userAgeIndex, { name: 'bob' }), IndexedFieldError);
  }

  @Test()
  async readBySortedIndexUsingId() {
    const service = await this.service;

    const first = await service.create(User3, User3.from({ name: 'bob', age: 40, color: 'blue' }));
    const second = await service.create(User3, User3.from({ name: 'bob', age: 40, color: 'green' }));

    const found = await service.getByIndex(User3, userAgeIndex, {
      name: 'bob',
      age: 40,
      id: second.id
    });

    assert(found.id === second.id);
    assert(found.color === 'green');

    await service.deleteByIndex(User3, userAgeIndex, { name: 'bob', age: 40, id: first.id });

    await assert.rejects(() => service.get(User3, first.id), NotFoundError);

    const remaining = await service.getByIndex(User3, userAgeIndex, { name: 'bob', age: 40, id: second.id });
    assert(remaining.id === second.id);
  }

  @Test()
  async queryList() {
    const service = await this.service;

    await service.create(User3, User3.from({ name: 'bob', age: 40, color: 'blue' }));
    await service.create(User3, User3.from({ name: 'bob', age: 30, color: 'red' }));
    await service.create(User3, User3.from({ name: 'bob', age: 50, color: 'green' }));

    const { items: arr } = await service.pageByIndex(User3, userAgeIndex, { name: 'bob' });

    console.error(arr);

    assert(arr[0].color === 'red');
    assert(arr[0].name === 'bob');
    assert(arr[1].color === 'blue');
    assert(arr[1].name === 'bob');
    assert(arr[2].color === 'green');
    assert(arr[2].name === 'bob');

    // @ts-expect-error
    await assert.rejects(() => service.pageByIndex(User3, userAgeIndex, {}), IndexedFieldError);
  }

  @Test()
  async queryListNoSelectedKeys() {
    const service = await this.service;

    await service.create(User3, User3.from({ name: 'charlie', age: 40, color: 'blue' }));
    await service.create(User3, User3.from({ name: 'alice', age: 30, color: 'red' }));
    await service.create(User3, User3.from({ name: 'bob', age: 50, color: 'green' }));

    const { items: arr } = await service.pageByIndex(User3, userAgeNoKeyIndex, {});

    assert(arr[0].name === 'alice' && arr[0].age === 30);
    assert(arr[1].name === 'charlie' && arr[1].age === 40);
    assert(arr[2].name === 'bob' && arr[2].age === 50);

    const found = await service.getByIndex(User3, userAgeNoKeyIndex, { age: 40 });
    assert(found.name === 'charlie');

    // @ts-expect-error
    await assert.rejects(() => service.getByIndex(User3, userAgeNoKeyIndex, {}), IndexedFieldError);
  }

  @Test({ skip: (self) => !castTo<ModelIndexedSuite>(self).supportsDeepIndexes })
  async queryDeepList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, color: 'green' }));

    const { items: arr } = await service.pageByIndex(User4, childAgeIndex, { child: { name: 'bob' } });
    assert(arr[0].color === 'red' && arr[0].child.name === 'bob' && arr[0].child.age === 30);
    assert(arr[1].color === 'blue' && arr[1].child.name === 'bob' && arr[1].child.age === 40);
    assert(arr[2].color === 'green' && arr[2].child.name === 'bob' && arr[2].child.age === 50);

    // @ts-expect-error
    await assert.rejects(() => service.pageByIndex(User4, childAgeIndex, {}), IndexedFieldError);
  }

  @Test({ skip: (self) => !castTo<ModelIndexedSuite>(self).supportsDeepIndexes })
  async queryComplexDateList() {
    const service = await this.service;

    await service.create(User4, User4.from({ child: { name: 'bob', age: 40 }, createdDate: TimeUtil.fromNow('3d'), color: 'blue' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 30 }, createdDate: TimeUtil.fromNow('2d'), color: 'red' }));
    await service.create(User4, User4.from({ child: { name: 'bob', age: 50 }, createdDate: TimeUtil.fromNow('-1d'), color: 'green' }));

    const { items: arr } = await service.pageByIndex(User4, nameCreatedIndex, { child: { name: 'bob' } });

    assert(arr[0].color === 'green' && arr[0].child.name === 'bob' && arr[0].child.age === 50);
    assert(arr[1].color === 'red' && arr[1].child.name === 'bob' && arr[1].child.age === 30);
    assert(arr[2].color === 'blue' && arr[2].child.name === 'bob' && arr[2].child.age === 40);

    // @ts-expect-error
    await assert.rejects(() => service.pageByIndex(User4, nameCreatedIndex, {}), IndexedFieldError);
  }

  @Test()
  async upsertByIndex() {
    const service = await this.service;

    const user1 = await service.upsertByIndex(User3, userAgeIndex, { name: 'bob', age: 40, color: 'blue' });
    const user2 = await service.upsertByIndex(User3, userAgeIndex, { name: 'bob', age: 40, color: 'green' });
    const user3 = await service.upsertByIndex(User3, userAgeIndex, { name: 'bob', age: 40, color: 'red' });

    const { items: arr } = await service.pageByIndex(User3, userAgeIndex, { name: 'bob' });
    assert(arr.length === 1);

    assert(user1.id === user2.id);
    assert(user2.id === user3.id);
    assert(user1.color === 'blue');
    assert(user3.color === 'red');

    const user4 = await service.upsertByIndex(User3, userAgeIndex, { name: 'bob', age: 30, color: 'red' });
    const { items: arr2 } = await service.pageByIndex(User3, userAgeIndex, { name: 'bob' });
    assert(arr2.length === 2);

    await service.deleteByIndex(User3, userAgeIndex, user1);

    const { items: arr3 } = await service.pageByIndex(User3, userAgeIndex, { name: 'bob' });
    assert(arr3.length === 1);
    assert(arr3[0].id === user4.id);
  }

  @Test()
  async updateByIndex() {
    const service = await this.service;

    const created = await service.create(User3, User3.from({ name: 'alice', age: 25, color: 'blue' }));

    const updated = await service.updateByIndex(User3, userAgeIndex, { ...created, color: 'red' });

    assert(updated.id === created.id);
    assert(updated.name === 'alice');
    assert(updated.age === 25);
    assert(updated.color === 'red');

    const found = await service.getByIndex(User3, userAgeIndex, { name: 'alice', age: 25 });
    assert(found.color === 'red');
  }

  @Test()
  async updatePartialByIndex() {
    const service = await this.service;

    const created = await service.create(User3, User3.from({ name: 'carol', age: 35, color: 'green' }));

    const updated = await service.updatePartialByIndex(User3, userAgeIndex, { name: 'carol', age: 35, color: 'yellow' });

    assert(updated.id === created.id);
    assert(updated.name === 'carol');
    assert(updated.age === 35);
    assert(updated.color === 'yellow');

    const found = await service.getByIndex(User3, userAgeIndex, { name: 'carol', age: 35 });
    assert(found.color === 'yellow');
  }

  @Test()
  async paginateByIndex() {
    const service = await this.service;

    const allColors = 'abcdefghijklmnopqrstuvwxyzABCDEFGHJIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+,<.>/?;:\'"[{]}|`~'.repeat(2).split('');

    for (const [i, color] of allColors.entries()) {
      await service.create(User3, User3.from({ name: 'page', age: (i + 1) * 10, color }));
    }

    const limit = 7;
    const items: string[] = [];
    let offset: string | undefined;

    do {
      const page = await service.pageByIndex(User3, userAgeIndex, { name: 'page' }, { limit, offset });
      items.push(...page.items.map(u => u.color!));
      offset = page.nextOffset;
    } while (offset);

    assert(items.length === allColors.length);
    assert.deepEqual(items, allColors);
  }

  @Test()
  async paginateByIndexReverse() {
    const service = await this.service;

    const allColors = 'abcdefghijklmnopqrstuvwxyzABCDEFGHJIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+,<.>/?;:\'"[{]}|`~'.repeat(2).split('');

    for (const [i, color] of allColors.entries()) {
      await service.create(User3, User3.from({ name: 'page', age: (i + 1) * 10, color }));
    }

    const limit = 7;
    const items: string[] = [];
    let offset: string | undefined;

    do {
      const page = await service.pageByIndex(User3, userAgeReversedIndex, { name: 'page' }, { limit, offset });
      items.push(...page.items.map(u => u.color!));
      offset = page.nextOffset;
    } while (offset);

    assert(items.length === allColors.length);
    assert.deepEqual(items, allColors.toReversed());
  }

  @Test()
  async listByIndexAbortSignal() {
    const service = await this.service;

    await Promise.all(
      [20, 30, 40].map(age => service.create(User3, User3.from({ name: 'page', age, color: `${age}` })))
    );

    const controller = new AbortController();
    const found: User3[] = [];

    for await (const items of service.listByIndex(User3, userAgeIndex, { name: 'page' }, { abort: controller.signal, batchSizeHint: 1 })) {
      found.push(...items);
      controller.abort();
      await timers.setTimeout(10);
    }

    if (this.indexLimitSkew) {
      assert(found.length < this.indexLimitSkew && found.length > 0);
    } else {
      assert(found.length === 1);
    }
  }
}
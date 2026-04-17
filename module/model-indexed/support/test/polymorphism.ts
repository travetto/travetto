import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Discriminated } from '@travetto/schema';
import { Model, NotFoundError, SubTypeNotSupportedError } from '@travetto/model';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelIndexedSupport } from '../../src/types/service.ts';
import { ModelIndexedUtil } from '../../src/util.ts';
import { keyedIndex } from '../../src/indexes.ts';

@Model()
@Discriminated('type')
export class IndexedWorker {
  id: string;
  type: string;
  name: string;
  age?: number;
}

const workerNameIndex = keyedIndex(IndexedWorker, {
  name: 'worker-name',
  key: { name: true, age: true }
});

@Model()
export class IndexedDoctor extends IndexedWorker {
  specialty: string;
}

@Model()
export class IndexedFirefighter extends IndexedWorker {
  firehouse: number;
}

@Model()
export class IndexedEngineer extends IndexedWorker {
  major: string;
}

@Suite()
export abstract class ModelIndexedPolymorphismSuite extends BaseModelSuite<ModelIndexedSupport> {

  @Test('Polymorphic index', { skip: BaseModelSuite.ifNot(ModelIndexedUtil.isSupported) })
  async polymorphicIndexGet() {
    const service = await this.service;
    const now = 30;
    const [doc, fire, eng] = [
      IndexedDoctor.from({ name: 'bob', specialty: 'feet', age: now }),
      IndexedFirefighter.from({ name: 'rob', firehouse: 20, age: now }),
      IndexedEngineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    const updated = await this.saveAll(IndexedWorker, [doc, fire, eng]);

    const result = await service.getByIndex(IndexedWorker, workerNameIndex, {
      age: now,
      name: 'rob'
    });

    assert(result instanceof IndexedFirefighter);

    try {
      const res2 = await service.getByIndex(IndexedFirefighter, workerNameIndex, {
        age: now,
        name: 'rob'
      });
      assert(res2 instanceof IndexedFirefighter); // If service allows for get by subtype
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError || err instanceof NotFoundError); // If it does not
    }
  }

  @Test('Polymorphic index', { skip: BaseModelSuite.ifNot(ModelIndexedUtil.isSupported) })
  async polymorphicIndexDelete() {
    const service = await this.service;
    const now = 30;
    const [doc, fire, eng] = [
      IndexedDoctor.from({ name: 'bob', specialty: 'feet', age: now }),
      IndexedFirefighter.from({ name: 'rob', firehouse: 20, age: now }),
      IndexedEngineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    await this.saveAll(IndexedWorker, [doc, fire, eng]);

    assert(await this.getSize(IndexedWorker) === 3);

    await service.deleteByIndex(IndexedWorker, workerNameIndex, {
      age: now,
      name: 'bob'
    });

    assert(await this.getSize(IndexedWorker) === 2);
    assert(await this.getSize(IndexedDoctor) === 0);

    try {
      await service.deleteByIndex(IndexedFirefighter, workerNameIndex, {
        age: now,
        name: 'rob'
      });
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError || err instanceof NotFoundError);
    }

    try {
      await service.deleteByIndex(IndexedEngineer, workerNameIndex, {
        age: now,
        name: 'bob'
      });
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError || err instanceof NotFoundError);
    }
  }
}
import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { castTo } from '@travetto/runtime';
import { SubTypeField, Text, TypeMismatchError } from '@travetto/schema';
import {
  ModelIndexedSupport, Index, ModelCrudSupport, Model,
  NotFoundError, SubTypeNotSupportedError, PersistValue
} from '@travetto/model';

import { ModelIndexedUtil } from '../../src/util/indexed.ts';
import { ExistsError } from '../../src/error/exists.ts';

import { BaseModelSuite } from './base.ts';

@Model({ baseType: true })
export class Worker {
  id: string;
  @SubTypeField()
  _type: string;
  @Text()
  name: string;
  age?: number;

  @PersistValue(() => new Date())
  updatedDate?: Date;
}

@Model()
export class Doctor extends Worker {
  specialty: string;
}

@Model()
export class Firefighter extends Worker {
  firehouse: number;
}

@Model()
export class Engineer extends Worker {
  major: string;
}

@Model({ baseType: true })
@Index({
  name: 'worker-name',
  type: 'sorted',
  fields: [{ name: 1 }, { age: 1 }]
})
export class IndexedWorker {
  id: string;
  type: string;
  name: string;
  age?: number;
}

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

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const el of iterable) {
    out.push(el);
  }
  return out;
}

@Suite()
export abstract class ModelPolymorphismSuite extends BaseModelSuite<ModelCrudSupport> {

  @Test('Polymorphic create and find')
  async polymorphicCreateAndFind() {
    const service = await this.service;
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const [doc, fire, eng] = await Promise.all(people.map(p => service.create(Worker, p)));

    assert(doc instanceof Doctor);
    assert(doc.updatedDate !== undefined);

    await assert.rejects(
      () => service.get(Engineer, doc.id),
      NotFoundError);

    assert(doc instanceof Doctor);
    assert(fire instanceof Firefighter);
    assert(eng instanceof Engineer);

    const doc2 = await service.get(Worker, doc.id);
    assert(doc2 instanceof Doctor);
    const fire2 = await service.get(Worker, fire.id);
    assert(fire2 instanceof Firefighter);

    const all = await collect(service.list(Worker));
    assert(all.length === 3);

    const doc3 = all.find(x => x instanceof Doctor);
    assert(doc3 instanceof Doctor);
    assert(doc3.specialty === 'feet');
    assert(doc3.name === 'bob');

    const fire3 = all.find(x => x instanceof Firefighter);
    assert(fire3 instanceof Firefighter);
    assert(fire3.firehouse === 20);
    assert(fire3.name === 'rob');

    const eng3 = all.find(x => x instanceof Engineer);
    assert(eng3 instanceof Engineer);
    assert(eng3.major === 'oranges');
    assert(eng3.name === 'cob');

    const engineers = await collect(service.list(Engineer));
    assert(engineers.length === 1);

    await service.create(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

    const all2 = await collect(service.list(Worker));
    assert(all2.length === 4);

    const engineers2 = await collect(service.list(Engineer));
    assert(engineers2.length === 2);
  }

  @Test('Polymorphic upsert and delete')
  async polymorphicUpsertAndDelete() {
    const service = await this.service;
    const [doc, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, fire, eng]);

    assert(await service.get(Worker, doc.id) instanceof Doctor);
    assert(await service.get(Worker, fire.id) instanceof Firefighter);

    const update = new Date();

    await assert.rejects(
      () =>
        service.upsert(Doctor, Doctor.from({
          id: fire.id, name: 'gob', specialty: 'eyes'
        })),
      e => e instanceof SubTypeNotSupportedError || e instanceof ExistsError
    );

    await assert.rejects(
      () => service.update(Engineer, castTo(Doctor.from({ ...doc }))),
      e => e instanceof NotFoundError || e instanceof SubTypeNotSupportedError || e instanceof TypeMismatchError
    );
    await timers.setTimeout(15);

    try {
      const res = await service.upsert(Doctor, Doctor.from({
        id: doc.id, name: 'gob', specialty: 'eyes'
      }));

      assert(res.updatedDate!.getTime() > update.getTime());
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError);
    }

    const resAlt = await service.upsert(Worker, Doctor.from({
      id: doc.id, name: 'gob', specialty: 'eyes'
    }));

    assert(resAlt.updatedDate!.getTime() > update.getTime());

    // Delete by wrong class
    await assert.rejects(
      () => service.delete(Doctor, fire.id),
      e => e instanceof SubTypeNotSupportedError || e instanceof NotFoundError
    );

    // Delete by base class
    await service.delete(Worker, fire.id);

    await assert.rejects(
      () => service.delete(Worker, fire.id),
      NotFoundError
    );

    // Delete by any subtype when id is missing
    await assert.rejects(
      () => service.delete(Firefighter, doc.id),
      e => e instanceof SubTypeNotSupportedError || e instanceof NotFoundError
    );
  }

  @Test('Polymorphic index', { skip: BaseModelSuite.ifNot(ModelIndexedUtil.isSupported) })
  async polymorphicIndexGet() {
    const service: ModelIndexedSupport = castTo(await this.service);
    const now = 30;
    const [doc, fire, eng] = [
      IndexedDoctor.from({ name: 'bob', specialty: 'feet', age: now }),
      IndexedFirefighter.from({ name: 'rob', firehouse: 20, age: now }),
      IndexedEngineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    await this.saveAll(IndexedWorker, [doc, fire, eng]);

    const res = await service.getByIndex(IndexedWorker, 'worker-name', {
      age: now,
      name: 'rob'
    });

    assert(res instanceof IndexedFirefighter);

    try {
      const res2 = await service.getByIndex(IndexedFirefighter, 'worker-name', {
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
    const service: ModelIndexedSupport = castTo(await this.service);
    const now = 30;
    const [doc, fire, eng] = [
      IndexedDoctor.from({ name: 'bob', specialty: 'feet', age: now }),
      IndexedFirefighter.from({ name: 'rob', firehouse: 20, age: now }),
      IndexedEngineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    await this.saveAll(IndexedWorker, [doc, fire, eng]);

    assert(await this.getSize(IndexedWorker) === 3);

    await service.deleteByIndex(IndexedWorker, 'worker-name', {
      age: now,
      name: 'bob'
    });

    assert(await this.getSize(IndexedWorker) === 2);
    assert(await this.getSize(IndexedDoctor) === 0);

    try {
      await service.deleteByIndex(IndexedFirefighter, 'worker-name', {
        age: now,
        name: 'rob'
      });
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError || err instanceof NotFoundError);
    }

    try {
      await service.deleteByIndex(IndexedEngineer, 'worker-name', {
        age: now,
        name: 'bob'
      });
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError || err instanceof NotFoundError);
    }
  }
}
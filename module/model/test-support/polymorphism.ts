import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Text, TypeMismatchError } from '@travetto/schema';

import { BaseModelSuite } from './base';
import {
  ModelIndexedSupport, Index, ModelCrudSupport, Model,
  BaseModel, NotFoundError, SubTypeNotSupportedError
} from '..';
import { isIndexedSupported } from '../src/internal/service/common';

@Model({ baseType: true })
@Index({
  name: 'worker-name',
  fields: [{ name: 1 }, { age: 1 }]
})
export class Worker extends BaseModel {
  name: string;
  age?: number;
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

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out = [] as T[];
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
    assert((fire3 as Firefighter).firehouse === 20);
    assert(fire3.name === 'rob');

    const eng3 = all.find(x => x instanceof Engineer);
    assert(eng3 instanceof Engineer);
    assert((eng3 as Engineer).major === 'oranges');
    assert(eng3.name === 'cob');

    const engineers = await collect(service.list(Engineer));
    assert(engineers.length === 1);

    await service.create(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

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
          id: fire.id, name: 'drob', specialty: 'eyes'
        })),
      e => (e instanceof SubTypeNotSupportedError || e instanceof NotFoundError) ? undefined : e
    );

    await assert.rejects(
      // @ts-expect-error
      () => service.update(Engineer, Doctor.from({ ...doc })),
      (e: Error) => (e instanceof NotFoundError || e instanceof SubTypeNotSupportedError || e instanceof TypeMismatchError) ? undefined : e);

    try {
      const res = await service.upsert(Doctor, Doctor.from({
        id: doc.id, name: 'drob', specialty: 'eyes'
      }));

      assert(res.updatedDate!.getTime() > update.getTime());
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError);
    }

    const resAlt = await service.upsert(Worker, Doctor.from({
      id: doc.id, name: 'drob', specialty: 'eyes'
    }));

    assert(resAlt.updatedDate!.getTime() > update.getTime());

    // Delete by wrong class
    await assert.rejects(
      () => service.delete(Doctor, fire.id),
      e => (e instanceof SubTypeNotSupportedError || e instanceof NotFoundError) ? undefined : e
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
      e => (e instanceof SubTypeNotSupportedError || e instanceof NotFoundError) ? undefined : e
    );
  }

  @Test('Polymorphic index', { skip: BaseModelSuite.ifNot(isIndexedSupported) })
  async polymorphicIndexGet() {
    const service = (await this.service) as unknown as ModelIndexedSupport;
    const now = 30;
    const [doc, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet', age: now }),
      Firefighter.from({ name: 'rob', firehouse: 20, age: now }),
      Engineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    await this.saveAll(Worker, [doc, fire, eng]);

    const res = await service.getByIndex(Worker, 'worker-name', {
      age: now,
      name: 'rob'
    });

    assert(res instanceof Firefighter);

    try {
      const res2 = await service.getByIndex(Firefighter, 'worker-name', {
        age: now,
        name: 'rob'
      });
      assert(res2 instanceof Firefighter); // If service allows for get by subtype
    } catch (e) {
      assert(e instanceof SubTypeNotSupportedError || e instanceof NotFoundError); // If it does not
    }
  }

  @Test('Polymorphic index', { skip: BaseModelSuite.ifNot(isIndexedSupported) })
  async polymorphicIndexDelete() {
    const service = (await this.service) as unknown as ModelIndexedSupport;
    const now = 30;
    const [doc, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet', age: now }),
      Firefighter.from({ name: 'rob', firehouse: 20, age: now }),
      Engineer.from({ name: 'cob', major: 'oranges', age: now })
    ];

    await this.saveAll(Worker, [doc, fire, eng]);

    assert(await this.getSize(Worker) === 3);

    await service.deleteByIndex(Worker, 'worker-name', {
      age: now,
      name: 'bob'
    });

    assert(await this.getSize(Worker) === 2);
    assert(await this.getSize(Doctor) === 0);

    try {
      await service.deleteByIndex(Firefighter, 'worker-name', {
        age: now,
        name: 'rob'
      });
    } catch (e) {
      assert(e instanceof SubTypeNotSupportedError || e instanceof NotFoundError);
    }

    try {
      await service.deleteByIndex(Engineer, 'worker-name', {
        age: now,
        name: 'bob'
      });
    } catch (e) {
      assert(e instanceof SubTypeNotSupportedError || e instanceof NotFoundError);
    }
  }
}
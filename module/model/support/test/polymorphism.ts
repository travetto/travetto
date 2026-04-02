import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { castTo } from '@travetto/runtime';
import { Schema, DiscriminatorField, Text, TypeMismatchError } from '@travetto/schema';
import {
  type ModelCrudSupport, Model,
  NotFoundError, SubTypeNotSupportedError, PersistValue
} from '@travetto/model';

import { ExistsError } from '../../src/error/exists.ts';

import { BaseModelSuite } from './base.ts';

@Schema()
@Model()
export abstract class Worker {
  id: string;
  @DiscriminatorField()
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

    const all = await Array.fromAsync(service.list(Worker));
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

    const engineers = await Array.fromAsync(service.list(Engineer));
    assert(engineers.length === 1);

    await service.create(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

    const all2 = await Array.fromAsync(service.list(Worker));
    assert(all2.length === 4);

    const engineers2 = await Array.fromAsync(service.list(Engineer));
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
      const result = await service.upsert(Doctor, Doctor.from({
        id: doc.id, name: 'gob', specialty: 'eyes'
      }));

      assert(result.updatedDate!.getTime() > update.getTime());
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
}
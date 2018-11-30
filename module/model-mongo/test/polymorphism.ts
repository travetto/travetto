import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';

import { BaseMongoTest } from './base';
import { ModelMongoSource } from '../src/source';

@Model({ baseType: true })
class Person extends BaseModel {
  name: string;
}

@Model()
class Doctor extends Person {
  speciality: string;
}

@Model()
class Firefighter extends Person {
  firehouse: number;
}

@Model()
class Engineer extends Person {
  major: string;
}

@Suite('Polymorphism')
class TestPolymorphism extends BaseMongoTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);

    assert.ok(source);
    assert(source instanceof ModelMongoSource);

  }

  @Test('Verify save and find and deserialize')
  async testUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const people = [
      Doctor.from({ name: 'bob', speciality: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const o = await service.saveAll(Person, people);

    assert(o[0] instanceof Doctor);
    await assert.throws(async () => {
      return service.update(Engineer, Doctor.from({ ...o[0] }) as any);
    }, 'Invalid update');

    await assert.throws(async () => {
      return service.getById(Engineer, o[0].id!);
    }, 'Invalid number');

    assert(o[1] instanceof Firefighter);
    assert(o[2] instanceof Engineer);

    const o2 = await service.getById(Person, o[0].id!);
    assert(o2 instanceof Doctor);
    const o3 = await service.getById(Person, o[1].id!);
    assert(o3 instanceof Firefighter);

    const all = await service.getAllByQuery(Person, { where: {} });
    assert(all.length === 3);
    assert(all[0] instanceof Doctor);
    assert((all[0] as Doctor).speciality === 'feet');
    assert(all[0].name === 'bob');

    assert(all[1] instanceof Firefighter);
    assert((all[1] as Firefighter).firehouse === 20);
    assert(all[1].name === 'rob');

    assert(all[2] instanceof Engineer);
    assert((all[2] as Engineer).major === 'oranges');
    assert(all[2].name === 'cob');

    const engineers = await service.getAllByQuery(Engineer, {});
    assert(engineers.length === 1);

    await service.save(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

    const engineers2 = await service.getAllByQuery(Engineer, {});
    assert(engineers2.length === 2);
  }

  @Test('Bulk operations')
  async testBulk() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const created1 = await service.save(Doctor, Doctor.from({ name: 'greg', speciality: 'hair' }));
    const created2 = await service.save(Doctor, Doctor.from({ name: 'breg', speciality: 'hearing' }));
    const created3 = await service.save(Doctor, Doctor.from({ name: 'wreg', speciality: 'eyess' }));

    const o = await service.bulkProcess(Person, [
      { insert: Doctor.from({ name: 'bob', speciality: 'feet' }) },
      { upsert: Firefighter.from({ id: '3534aaaa3c19', name: 'rob', firehouse: 20 }) },
      { upsert: Firefighter.from({ name: 'rob', firehouse: 20 }) },
      { update: Doctor.from(created1) },
      { upsert: Doctor.from({ id: created2.id, name: 'shmeg', speciality: 'arms' }) },
      { delete: Doctor.from({ id: created3.id }) }
    ]);

    assert(o.counts.insert === 1);
    assert(o.counts.upsert === 2);
    assert(o.counts.update === 2);
    assert(o.counts.delete === 1);

    assert(o.insertedIds.size === 2);
    assert(Array.from(o.insertedIds.keys()) === [0, 2]);
  }
}

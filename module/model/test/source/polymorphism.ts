import * as assert from 'assert';

import { Test } from '@travetto/test';

import { Model, BaseModel } from '../..';
import { BaseModelTest } from '../lib/test.base';

@Model({ baseType: true })
export class Person extends BaseModel {
  name: string;
}

@Model()
export class Doctor extends Person {
  specialty: string;
}

@Model()
export class Firefighter extends Person {
  firehouse: number;
}

@Model()
export class Engineer extends Person {
  major: string;
}

export abstract class BasePolymorphismSuite extends BaseModelTest {

  @Test('Verify save and find and deserialize')
  async testUpdate() {
    const service = await this.service;
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const o = await service.saveAll(Person, people);

    assert(o[0] instanceof Doctor);
    await assert.rejects(
      async () => service.update(Engineer, Doctor.from({ ...o[0] }) as any),
      'Expected object of type Engineer');

    await assert.rejects(
      async () => service.getById(Engineer, o[0].id!),
      'Invalid number');

    assert(o[0] instanceof Doctor);
    assert(o[1] instanceof Firefighter);
    assert(o[2] instanceof Engineer);

    const o2 = await service.getById(Person, o[0].id!);
    assert(o2 instanceof Doctor);
    const o3 = await service.getById(Person, o[1].id!);
    assert(o3 instanceof Firefighter);

    const all = await service.getAllByQuery(Person, { where: {} });
    assert(all.length === 3);

    const dIdx = all.findIndex(x => x instanceof Doctor);
    assert(all[dIdx] instanceof Doctor);
    assert((all[dIdx] as Doctor).specialty === 'feet');
    assert(all[dIdx].name === 'bob');

    const fIdx = all.findIndex(x => x instanceof Firefighter);
    assert(all[fIdx] instanceof Firefighter);
    assert((all[fIdx] as Firefighter).firehouse === 20);
    assert(all[fIdx].name === 'rob');

    const eIdx = all.findIndex(x => x instanceof Engineer);
    assert(all[eIdx] instanceof Engineer);
    assert((all[eIdx] as Engineer).major === 'oranges');
    assert(all[eIdx].name === 'cob');

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
    const service = await this.service;
    const created1 = await service.save(Doctor, Doctor.from({ name: 'greg', specialty: 'hair' }));
    const created2 = await service.save(Doctor, Doctor.from({ name: 'breg', specialty: 'hearing' }));
    const created3 = await service.save(Doctor, Doctor.from({ name: 'wreg', specialty: 'eyess' }));

    const o = await service.bulkProcess(Person, [
      { insert: Doctor.from({ name: 'bob', specialty: 'feet' }) },
      { insert: Doctor.from({ name: 'bob2', specialty: 'feet' }) },
      { upsert: Firefighter.from({ id: service.generateId(), name: 'rob', firehouse: 20 }) },
      { upsert: Firefighter.from({ name: 'rob', firehouse: 20 }) },
      { update: Doctor.from(created1) },
      { upsert: Doctor.from({ id: created2.id, name: 'shmeg', specialty: 'arms' }) },
      { delete: Doctor.from({ id: created3.id }) }
    ]);

    assert(o.counts.insert === 2);
    assert(o.counts.update === 1);
    assert(o.counts.delete === 1);
    assert(o.counts.upsert === 3);

    assert(o.insertedIds.size === 4);
    assert(Array.from(o.insertedIds.keys()).sort() === [0, 1, 2, 3]);
  }
}

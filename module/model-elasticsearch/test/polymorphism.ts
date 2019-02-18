import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';

import { BaseElasticsearchTest } from './base';
import { ModelElasticsearchSource } from '../src/source';

@Model({ baseType: true })
class Person extends BaseModel {
  name: string;
}

@Model()
class Doctor extends Person {
  specialty: string;
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
class TestPolymorphism extends BaseElasticsearchTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);

    assert.ok(source);
    assert(source instanceof ModelElasticsearchSource);

  }

  @Test('Extraction')
  async testRetrieve() {
    const service = (await DependencyRegistry.getInstance(ModelSource)) as ModelElasticsearchSource;
    const res = service.getClassFromIndexType('person', 'doctor');
    assert(res === Doctor);
  }

  @Test('Verify save and find and deserialize')
  async testUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const o = await service.saveAll(Person, people);

    assert(o[0] instanceof Doctor);
    await assert.rejects(async () => {
      return service.update(Engineer, Doctor.from({ ...o[0] }) as any);
    }, 'Expected object of type Engineer');

    await assert.rejects(async () => {
      return service.getById(Engineer, o[0].id!);
    }, 'Invalid number');

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
    const service = await DependencyRegistry.getInstance(ModelService);
    const created1 = await service.save(Doctor, Doctor.from({ name: 'greg', specialty: 'hair' }));
    const created2 = await service.save(Doctor, Doctor.from({ name: 'b.reg', specialty: 'hearing' }));
    const created3 = await service.save(Doctor, Doctor.from({ name: 'w.reg', specialty: 'eyes' }));

    const o = await service.bulkProcess(Person, [
      { insert: Doctor.from({ name: 'bob', speciality: 'feet' }) },
      { upsert: Firefighter.from({ id: '3534aaaa3c19', name: 'rob', firehouse: 20 }) },
      { upsert: Firefighter.from({ name: 'rob', firehouse: 20 }) },
      { update: Doctor.from(created1) },
      { upsert: Doctor.from({ id: created2.id, name: 'sh.meg', speciality: 'arms' }) },
      { delete: Doctor.from({ id: created3.id }) }
    ]);

    assert(o.counts.insert === 0);
    assert(o.counts.upsert === 4);
    assert(o.counts.update === 1);
    assert(o.counts.delete === 1);

    assert(o.insertedIds.size === 3);
    assert(Array.from(o.insertedIds.keys()) === [0, 1, 2]);
  }

  @Test('Multi Query')
  async testMultiQuery() {
    const service = (await DependencyRegistry.getInstance(ModelSource)) as ModelElasticsearchSource;
    const res = service.buildRawModelFilters([Person, Doctor, Engineer, Firefighter]);

    assert(res.bool.should.length === 4);
    assert(res.bool.should[0].term);
    assert(res.bool.should[1].bool);
    assert(res.bool.should[1].bool!.must.length);

    await this.testBulk();

    const rawRes = await service.getRawMultiQuery<Person>([Firefighter, Engineer], {});
    const items = await service.convertRawResponse(rawRes);
    assert(items.length === 2);
    assert(items[0] instanceof Firefighter);
  }
}

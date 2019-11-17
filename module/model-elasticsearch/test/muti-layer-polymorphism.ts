import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { BaseModelTest } from '@travetto/model/extension/base.test';

import { ElasticsearchModelSource } from '../src/source';
import { ElasticsearchModelConfig } from '../src/config';

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

@Model({ baseType: true })
class Engineer extends Person {
  major: string;
}

@Model()
class SoftwareEngineer extends Engineer {
  language: string;
}

@Model()
class CivilEngineer extends Engineer {
  discipline: string;
}

@Suite('Polymorphism')
class TestMultilayerPolymorphism extends BaseModelTest {

  configClass = ElasticsearchModelConfig;
  sourceClass = ElasticsearchModelSource;

  @BeforeAll()
  doInit() {
    return super.init();
  }

  @Test('Extraction')
  async testRetrieve() {
    const service = (await DependencyRegistry.getInstance(ModelSource)) as ElasticsearchModelSource;
    const res = service.getClassFromIndexType('person', 'doctor');
    assert(res === Doctor);

    const res2 = service.getClassFromIndexType('engineer', 'software_engineer');
    assert(res2 === SoftwareEngineer);
  }

  @Test('Verify save and find and deserialize')
  async testUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
    ];
    const o = await service.saveAll(Person, people);

    assert(o[0] instanceof Doctor);

    await assert.rejects(
      async () => service.update(Engineer, Doctor.from({ ...o[0] }) as any),
      'Expected object of type Engineer');

    assert(o[0] instanceof Doctor);
    assert(o[1] instanceof Firefighter);

    const engineerList = [
      CivilEngineer.from({ name: 'cob', major: 'oranges', discipline: 'roads' })
    ];

    assert((await service.getAllByQuery(Person, { where: {} })).length === 2);

    await service.saveAll(Engineer, engineerList);

    const all = await service.getAllByQuery(Engineer, { where: {} });
    assert(all.length === 1);

    const eidx = all.findIndex(x => x instanceof CivilEngineer);
    assert(all[eidx] instanceof Engineer);
    assert(all[eidx].major === 'oranges');
    assert((all[eidx] as CivilEngineer).discipline === 'roads');
    assert(all[eidx].name === 'cob');

    await service.save(Engineer, SoftwareEngineer.from({
      major: 'foodService',
      name: 'bob2',
      language: 'c'
    }));

    const engineers = await service.getAllByQuery(Engineer, {});
    assert(engineers.length === 2);
  }

  @Test('Bulk operations')
  async testBulk() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const created1 = await service.save(Engineer, CivilEngineer.from({ name: 'greg', discipline: 'roads', major: 'engineering' }));
    const created2 = await service.save(Engineer, CivilEngineer.from({ name: 'breg', discipline: 'roads', major: 'engineering' }));
    const created3 = await service.save(Engineer, CivilEngineer.from({ name: 'wreg', discipline: 'roads', major: 'engineering' }));

    const o = await service.bulkProcess(Engineer, [
      { insert: CivilEngineer.from({ name: 'bob', discipline: 'feet' }) },
      { upsert: SoftwareEngineer.from({ id: '3534aaaa3c19', name: 'rob', major: 'software', language: 'c' }) },
      { upsert: SoftwareEngineer.from({ name: 'rob', major: 'software', language: 'c' }) },
      { update: CivilEngineer.from(created1) },
      { upsert: CivilEngineer.from({ id: created2.id, name: 'shmeg', discipline: 'arms' }) },
      { delete: CivilEngineer.from({ id: created3.id }) }
    ]);

    assert(o.counts.insert === 1);
    assert(o.counts.upsert === 3);
    assert(o.counts.update === 1);
    assert(o.counts.delete === 1);

    assert(o.insertedIds.size === 3);
    assert(Array.from(o.insertedIds.keys()) === [0, 1, 2]);
  }

  @Test('Multi Query')
  async testMultiQuery() {
    const service = (await DependencyRegistry.getInstance(ModelSource)) as ElasticsearchModelSource;
    const res = service.buildRawModelFilters<Engineer>([SoftwareEngineer, CivilEngineer]);

    assert(res.bool.should.length === 2);
    assert(res.bool.should[1].bool);
    assert(res.bool.should[1].bool!.must.length);

    await this.testBulk();

    const rawRes = await service.getRawMultiQuery<Person>([Person, Engineer], {});
    const items = await service.convertRawResponse(rawRes);
    assert(items.length === 5);
    assert(items[0] instanceof CivilEngineer);

    await service.save(Person, Firefighter.from({
      firehouse: 5,
      name: 'bob',
    }));

    const rawRes2 = await service.getRawMultiQuery<Person>([Person, Engineer], {});
    const items2 = await service.convertRawResponse(rawRes2);

    assert(items2.length === 6);

    assert.ok(items2.find(x => x instanceof Firefighter));
  }
}

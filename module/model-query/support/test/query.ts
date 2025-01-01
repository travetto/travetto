import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { ModelCrudSupport } from '@travetto/model/src/service/crud';
import { TimeUtil } from '@travetto/runtime';
import { NotFoundError } from '@travetto/model';

import { Aged, Location, Names, Note, Person, SimpleList, WithNestedLists, WithNestedNestedLists } from './types';

import { ModelQuerySupport } from '../../src/service/query';

@Suite()
export abstract class ModelQuerySuite extends BaseModelSuite<ModelQuerySupport & ModelCrudSupport> {

  supportsGeo = true;

  @Test('verify word boundary')
  async testWordBoundary() {
    const service = await this.service;
    await this.saveAll(Person, [1, 2, 3, 8].map(x => Person.from({
      name: 'Bob Omber',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    })));

    const results = await service.query(Person, { where: { name: { $regex: /\bomb.*/i } } });
    assert(results.length === 4);

    const results2 = await service.query(Person, { where: { name: { $regex: /\bmbo.*/i } } });
    assert(results2.length === 0);

    const results3 = await service.query(Person, { where: { name: { $regex: /\bomb.*/ } } });
    assert(results3.length === 0);
  }


  @Test('verify query one behavior')
  async testQueryOne() {
    const service = await this.service;
    await this.saveAll(Person, [1, 2, 3, 8].map(x => Person.from({
      name: 'Bob Omber',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    })));

    await assert.rejects(() => service.queryOne(Person, { where: { gender: 'm' } }), /Invalid number of results/);
    await assert.rejects(() => service.queryOne(Person, { where: { gender: 'z' } }), NotFoundError);
    await assert.rejects(() => service.queryOne(Person, { where: { gender: 'z' } }), /No results found for query/);
    await assert.rejects(() => service.queryOne(Person, { where: { id: 'orange' } }), NotFoundError);
    await assert.rejects(() => service.queryOne(Person, { where: { id: 'orange' } }), /orange/);
  }

  @Test('Verify array $in queries work properly')
  async testArrayContains() {
    const svc = await this.service;
    await svc.create(SimpleList, SimpleList.from({
      names: ['a', 'b', 'c']
    }));

    await svc.create(SimpleList, SimpleList.from({
      names: ['b', 'c', 'd']
    }));

    const single = await svc.query(SimpleList, {
      where: {
        names: {
          $in: ['a']
        }
      }
    });
    assert(single.length === 1);

    const multi = await svc.query(SimpleList, {
      where: {
        names: {
          $in: ['a', 'd']
        }
      }
    });
    assert(multi.length === 2);

    const multiIntersect = await svc.query(SimpleList, {
      where: {
        names: {
          $in: ['b', 'c']
        }
      }
    });
    assert(multiIntersect.length === 2);

    const none = await svc.query(SimpleList, {
      where: {
        names: {
          $in: ['z', 'w']
        }
      }
    });
    assert(none.length === 0);
  }

  @Test('verify all operators')
  async testArrayAll() {
    const service = await this.service;

    await this.saveAll(Names, [
      Names.from({ values: ['a', 'b', 'c'] }),
      Names.from({ values: ['a', 'b'] }),
      Names.from({ values: ['b', 'c'] }),
    ]);

    const results = await service.query(Names, {});
    assert(results.length === 3);

    const results2 = await service.query(Names, {
      where: {
        values: {
          $all: ['a', 'b', 'c']
        }
      }
    });

    assert(results2.length === 1);

    const results3 = await service.query(Names, {
      where: {
        values: {
          $all: ['a', 'b']
        }
      }
    });

    assert(results3.length === 2);

    const results4 = await service.query(Names, {
      where: {
        values: {
          $all: ['a', 'a', 'b']
        }
      }
    });

    assert(results4.length === 2);

    const results5 = await service.query(Names, {
      where: {
        values: {
          $all: ['b', 'b', 'b']
        }
      }
    });

    assert(results5.length === 3);
  }

  @Test('verify sorting')
  async testSorting() {
    const service = await this.service;

    const people = [1, 2, 3, 8].map(x => Person.from({
      id: service.idSource.create(),
      name: 'Bob',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    }));

    await this.saveAll(Person, people);

    const all = await service.query(Person, {
      sort: [{
        age: -1
      }]
    });
    assert(all[0].age >= all[1].age);
  }


  @Test('Test within')
  async testWithin() {
    if (!this.supportsGeo) {
      return;
    }

    const svc = await this.service;

    const toAdd = [];

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        toAdd.push(Location.from({
          point: [i, j],
        }));
      }
    }

    await this.saveAll(Location, toAdd);

    assert(await svc.queryCount(Location, {}) === 25);

    const ret = await svc.query(Location, {
      limit: 100,
      where: {
        point: {
          $geoWithin: [[-1, -1], [-1, 6], [6, 6], [6, -1]]
        }
      }
    });

    assert(ret.length === 25);

    const rad = await svc.query(Location, {
      limit: 100,
      where: {
        point: {
          $near: [3, 3],
          $maxDistance: 100,
          $unit: 'km'
        }
      }
    });
    assert(rad.length < 25);
    assert(rad.length > 0);
  }


  @Test()
  async verifyNestedQuery() {
    const service = await this.service;

    const id = service.idSource.create();

    await service.create(Note, Note.from({
      id,
      entities: [
        {
          label: 'hi',
          id
        }
      ]
    }));

    const out = await service.queryCount(Note, {
      where: {
        entities: {
          id
        }
      }
    });

    assert(out === 1);

    const out2 = await service.query(Note, {
      where: {
        entities: {
          id
        }
      }
    });

    assert(out2.length === 1);
  }

  @Test()
  async verifyDateRange() {
    const service = await this.service;
    await this.saveAll(Aged, (['-5d', '-4d', '-3d', '-2d', '-1d', '0d', '1d', '2d', '3d', '4d', '5d'] as const).map(delta =>
      Aged.from({ createdAt: TimeUtil.fromNow(delta) })
    ));

    const simple = await service.queryCount(Aged, {
      where: {
        createdAt: {
          $gt: new Date()
        }
      }
    });
    assert(simple === 5);


    const simple2 = await service.queryCount(Aged, {
      where: {
        createdAt: {
          $gt: '-1d'
        }
      }
    });
    assert(simple2 === 6);


    const simple3 = await service.queryCount(Aged, {
      where: {
        createdAt: {
          $gt: '-.9d',
          $lt: '2.9d'
        }
      }
    });
    assert(simple3 === 3);

    const simple4 = await service.queryCount(Aged, {
      where: {
        createdAt: {
          $gt: TimeUtil.fromNow('-0.1d'),
          $lt: TimeUtil.fromNow('2.9d')
        }
      }
    });
    assert(simple4 === 3);
  }

  @Test()
  async verifyArrayEmptyVsNot() {
    const service = await this.service;
    await service.create(WithNestedLists, {
      tags: ['a', 'b']
    });

    await service.create(WithNestedLists, {
      names: ['c', 'd'],
    });

    await service.create(WithNestedLists, {
      names: ['c', 'd'],
      tags: ['e', 'f']
    });

    await service.create(WithNestedLists, {
      names: ['g', 'h'],
      tags: []
    });

    await service.create(WithNestedLists, {
      names: [],
      tags: []
    });

    let total = await service.queryCount(WithNestedLists, {
      where: {
        names: { $exists: true }
      }
    });
    assert(total === 3);
    total = await service.queryCount(WithNestedLists, {
      where: {
        names: { $exists: false }
      }
    });
    assert(total === 2);

    total = await service.queryCount(WithNestedLists, {
      where: {
        tags: { $exists: false }
      }
    });
    assert(total === 3);

    total = await service.queryCount(WithNestedLists, {
      where: {
        tags: { $exists: true }
      }
    });
    assert(total === 2);

    total = await service.queryCount(WithNestedLists, {
      where: {
        tags: { $exists: false },
        names: { $exists: false }
      }
    });
    assert(total === 1);

    total = await service.queryCount(WithNestedLists, {
      where: {
        tags: { $exists: true },
        names: { $exists: true }
      }
    });

    assert(total === 1);
  }

  @Test()
  async verifyNestedArrayEmptyVsNot() {
    const service = await this.service;
    await service.create(WithNestedNestedLists, {
      tags: ['a', 'b']
    });

    await service.create(WithNestedNestedLists, {
      sub: { names: ['c', 'd'] },
    });

    await service.create(WithNestedNestedLists, {
      sub: { names: ['c', 'd'] },
      tags: ['e', 'f']
    });

    await service.create(WithNestedNestedLists, {
      sub: { names: ['g', 'h'] },
      tags: []
    });

    await service.create(WithNestedNestedLists, {
      sub: {},
      tags: []
    });

    let total = await service.queryCount(WithNestedNestedLists, {
      where: {
        sub: { names: { $exists: true } }
      }
    });
    assert(total === 3);
    total = await service.queryCount(WithNestedNestedLists, {
      where: {
        sub: { names: { $exists: false } }
      }
    });
    assert(total === 2);

    total = await service.queryCount(WithNestedNestedLists, {
      where: {
        tags: { $exists: false }
      }
    });
    assert(total === 3);

    total = await service.queryCount(WithNestedNestedLists, {
      where: {
        tags: { $exists: true }
      }
    });
    assert(total === 2);

    total = await service.queryCount(WithNestedNestedLists, {
      where: {
        tags: { $exists: false },
        sub: { names: { $exists: false } }
      }
    });
    assert(total === 1);

    total = await service.queryCount(WithNestedNestedLists, {
      where: {
        tags: { $exists: true },
        sub: { names: { $exists: true } }
      }
    });

    assert(total === 1);
  }
}


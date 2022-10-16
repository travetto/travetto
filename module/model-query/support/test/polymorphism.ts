import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { ModelCrudSupport } from '@travetto/model/src/service/crud';
import { Doctor, Engineer, Worker, Firefighter } from '@travetto/model/support/test/polymorphism';
import { NotFoundError } from '@travetto/model/src/error/not-found';

import { ModelQueryCrudSupport } from '../../src/service/crud';
import { ModelQuerySupport } from '../../src/service/query';
import { ModelQueryFacetSupport } from '../../src/service/facet';
import { ModelQuerySuggestSupport } from '../../src/service/suggest';

import { isQueryCrudSupported, isQueryFacetSupported, isQuerySuggestSupported } from '../../src/internal/service/common';

@Suite()
export abstract class ModelQueryPolymorphismSuite extends BaseModelSuite<ModelQuerySupport & ModelCrudSupport> {

  @Test()
  async testQuery() {
    const svc = await this.service;
    const [doc, doc2, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Doctor.from({ name: 'nob', specialty: 'eyes' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, doc2, fire, eng]);

    assert((await svc.query(Worker, {})).length === 4);
    assert((await svc.query(Firefighter, {})).length === 1);
    assert((await svc.query(Doctor, {})).length === 2);
    assert((await svc.query(Engineer, {})).length === 1);

    assert(await svc.queryCount(Worker, { where: 'name == "bob"' }) === 1);
    assert(await svc.queryCount(Doctor, { where: 'name == "bob"' }) === 1);
    assert(await svc.queryCount(Engineer, { where: 'name == "bob"' }) === 0);

    assert((await svc.queryOne(Worker, { where: { name: 'bob' } })) instanceof Doctor);
    await assert.rejects(() => svc.queryOne(Firefighter, { where: { name: 'bob' } }), NotFoundError);
  }

  @Test({ skip: ModelQueryPolymorphismSuite.ifNot(isQueryCrudSupported) })
  async testCrudQuery() {
    const svc = await this.service as unknown as ModelQueryCrudSupport & ModelQuerySupport;
    const [doc, doc2, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Doctor.from({ name: 'nob', specialty: 'eyes' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, doc2, fire, eng]);
    assert(await this.getSize(Worker) === 4);

    const c = await svc.updateByQuery(Doctor, { where: { specialty: 'feet' } }, { specialty: 'eyes' });
    assert(c === 1);

    assert((await svc.queryCount(Doctor, { where: { specialty: 'eyes' } })) === 2);

    const removed = await svc.deleteByQuery(Worker, { where: { name: 'rob' } });

    assert(removed === 1);

    assert(await this.getSize(Worker) === 3);
    assert(await this.getSize(Firefighter) === 0);
  }

  @Test({ skip: ModelQueryPolymorphismSuite.ifNot(isQuerySuggestSupported) })
  async testSuggestQuery() {
    const svc = await this.service as unknown as ModelQuerySuggestSupport & ModelQuerySupport;
    const [doc, doc2, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'eyes' }),
      Doctor.from({ name: 'nob', specialty: 'eyes' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, doc2, fire, eng]);
    assert(await this.getSize(Worker) === 4);

    assert((await svc.suggest(Worker, 'name', '')).length === 4);
    assert((await svc.suggestValues(Worker, 'name', '')).length === 4);
    assert((await svc.suggest(Worker, 'name', 'r')).length === 1);
    assert((await svc.suggest(Worker, 'name', 'r'))[0] instanceof Firefighter);
    assert((await svc.suggest(Doctor, 'name', 'r')).length === 0);
    assert((await svc.suggest(Firefighter, 'name', 'r')).length === 1);

    assert((await svc.suggestValues(Firefighter, 'name', 'r')).length === 1);
    assert((await svc.suggestValues(Firefighter, 'name', 'r'))[0] === 'rob');
  }

  @Test({ skip: ModelQueryPolymorphismSuite.ifNot(isQueryFacetSupported) })
  async testFacetQuery() {
    const svc = await this.service as unknown as ModelQueryFacetSupport & ModelQuerySupport;
    const [doc, doc2, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'eyes' }),
      Doctor.from({ name: 'nob', specialty: 'eyes' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, doc2, fire, eng]);
    assert(await this.getSize(Worker) === 4);

    assert((await svc.facet(Worker, 'name')).length === 4);
    const docFacet = await svc.facet(Doctor, 'specialty');
    assert.deepStrictEqual(docFacet, [{ count: 2, key: 'eyes' }]);
  }
}
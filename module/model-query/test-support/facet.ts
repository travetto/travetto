import * as assert from 'assert';

import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/test-support/base';
import { Suite, Test } from '@travetto/test';
import { SchemaFakerUtil } from '@travetto/schema';

import { Person } from './types';
import { ModelQueryFacetSupport } from '../src/service/facet';

@Suite()
export abstract class ModelQueryFacetSuite extends BaseModelSuite<ModelQueryFacetSupport & ModelCrudSupport> {

  @Test('verify aggregations')
  async testFacet() {
    const people = ' '.repeat(50)
      .split('')
      .map(() => SchemaFakerUtil.generate(Person));

    const svc = await this.service;
    const saved = await this.saveAll(Person, people);

    assert(saved === 50);

    const results = await svc.facet(Person, 'gender');

    assert(results.length === 2);
    assert(results[0].count >= results[1].count);

    const genders = people.reduce((acc, p) => { (acc[p.gender] += 1); return acc; }, { m: 0, f: 0 });

    assert(results.find(x => x.key === 'm')!.count === genders.m);
    assert(results.find(x => x.key === 'f')!.count === genders.f);

    const names: Record<string, number> = {};
    for (const el of people) {
      names[el.name!] = (names[el.name!] || 0) + 1;
    }

    const nameFacet = await svc.facet(Person, 'name');
    assert(Object.keys(names).length === nameFacet.length);
  }
}
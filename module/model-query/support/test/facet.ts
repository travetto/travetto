import * as assert from 'assert';

import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { Suite, Test } from '@travetto/test';

import { Person } from './types';
import { ModelQueryFacetSupport } from '../../src/service/facet';

const pick = <T>(arr: T[]): T => arr[Math.trunc(Math.random() * arr.length)]!;

const GENDERS = ['m', 'f'] as ['m', 'f'];
const FNAME = ['Bob', 'Tom', 'Sarah', 'Leo', 'Alice', 'Jennifer', 'Tommy', 'George', 'Paula', 'Sam'];
const LNAME = ['Smith', 'Sampson', 'Thompson', 'Oscar', 'Washington', 'Jefferson', 'Samuels'];
const AGES = new Array(100).fill(0).map((x, i) => i + 10);

@Suite()
export abstract class ModelQueryFacetSuite extends BaseModelSuite<ModelQueryFacetSupport & ModelCrudSupport> {

  @Test('verify aggregations')
  async testFacet() {
    const people = ' '.repeat(50)
      .split('')
      .map(() => Person.from({
        age: pick(AGES),
        gender: pick(GENDERS),
        name: `${pick(FNAME)} ${pick(LNAME)}`,
        address: {
          street1: `${pick(AGES)} ${pick(LNAME)} Road`
        }
      }));

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
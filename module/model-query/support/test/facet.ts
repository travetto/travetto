import assert from 'node:assert';

import type { ModelCrudSupport } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelQueryFacetSupport } from '../../src/types/facet.ts';
import { Person, WithNestedLists, WithNestedNestedLists } from './model.ts';

const pick = <T>(arr: T[] | readonly T[]): T => arr[Math.trunc(Math.random() * arr.length)]!;

const GENDERS = ['m', 'f'] as const;
const FNAME = ['Bob', 'Tom', 'Sarah', 'Leo', 'Alice', 'Jennifer', 'Tommy', 'George', 'Paula', 'Sam'];
const LNAME = ['Smith', 'Sampson', 'Thompson', 'Oscar', 'Washington', 'Jefferson', 'Samuel'];
const AGES = new Array(100).fill(0).map((x, i) => i + 10);

@Suite()
export abstract class ModelQueryFacetSuite extends BaseModelSuite<ModelQueryFacetSupport & ModelCrudSupport> {
  @Test('verify aggregations')
  async testFacet() {
    const people = ' '
      .repeat(50)
      .split('')
      .map(() =>
        Person.from({
          age: pick(AGES),
          gender: pick(GENDERS),
          name: `${pick(FNAME)} ${pick(LNAME)}`,
          address: {
            street1: `${pick(AGES)} ${pick(LNAME)} Road`
          }
        })
      );

    const service = await this.service;
    const saved = await this.saveAll(Person, people);

    assert(saved === 50);

    const results = await service.facetByQuery(Person, 'gender');

    assert(results.length === 2);
    assert(results[0].count >= results[1].count);

    const genders = people.reduce(
      (acc, p) => {
        acc[p.gender] += 1;
        return acc;
      },
      { m: 0, f: 0 }
    );

    assert(results.find(x => x.key === 'm')!.count === genders.m);
    assert(results.find(x => x.key === 'f')!.count === genders.f);

    const names: Record<string, number> = {};
    for (const el of people) {
      names[el.name!] = (names[el.name!] || 0) + 1;
    }

    const nameFacet = await service.facetByQuery(Person, 'name');
    assert(Object.keys(names).length === nameFacet.length);

    const limitedResults = await service.facetByQuery(Person, 'gender', { limit: 1 });
    assert(limitedResults.length === 1);
    assert(limitedResults[0].count === Math.max(genders.m, genders.f));

    const offsetGender = await service.facetByQuery(Person, 'gender', { limit: 1, offset: 1 });
    assert(offsetGender.length === 1);
    assert(offsetGender[0].count === Math.min(genders.m, genders.f));
    assert(offsetGender[0].key !== limitedResults[0].key);

    const topNames = await service.facetByQuery(Person, 'name', { limit: 5 });
    assert(topNames.length === Math.min(5, Object.keys(names).length));
    assert(topNames[0].count >= (topNames[1]?.count ?? 0));
  }

  @Test('verify string array faceting')
  async testFacetStringArray() {
    const service = await this.service;
    await this.saveAll(WithNestedLists, [
      WithNestedLists.from({ tags: ['apple', 'banana', 'apricot'] }),
      WithNestedLists.from({ tags: ['apple', 'blueberry'] }),
      WithNestedLists.from({ tags: ['apple', 'banana'] })
    ]);

    const tagFacets = await service.facetByQuery(WithNestedLists, 'tags');
    assert(tagFacets.length === 4);
    assert(tagFacets[0].key === 'apple' && tagFacets[0].count === 3);
    assert(tagFacets[1].key === 'banana' && tagFacets[1].count === 2);

    const limitedFacets = await service.facetByQuery(WithNestedLists, 'tags', { limit: 2 });
    assert(limitedFacets.length === 2);
    assert(limitedFacets[0].key === 'apple' && limitedFacets[0].count === 3);
    assert(limitedFacets[1].key === 'banana' && limitedFacets[1].count === 2);

    const offsetFacets = await service.facetByQuery(WithNestedLists, 'tags', { limit: 2, offset: 1 });
    assert(offsetFacets.length === 2);
    assert(offsetFacets[0].key === 'banana' && offsetFacets[0].count === 2);

    await this.saveAll(WithNestedNestedLists, [
      WithNestedNestedLists.from({ sub: { names: ['alex', 'amber'] } }),
      WithNestedNestedLists.from({ sub: { names: ['alex', 'avocado'] } })
    ]);

    const nestedFacets = await service.facetByQuery(WithNestedNestedLists, 'sub.names');
    assert(nestedFacets.length === 3);
    assert(nestedFacets[0].key === 'alex' && nestedFacets[0].count === 2);

    const limitedNestedFacets = await service.facetByQuery(WithNestedNestedLists, 'sub.names', { limit: 1 });
    assert(limitedNestedFacets.length === 1);
    assert(limitedNestedFacets[0].key === 'alex' && limitedNestedFacets[0].count === 2);

    const offsetNestedFacets = await service.facetByQuery(WithNestedNestedLists, 'sub.names', { limit: 2, offset: 1 });
    assert(offsetNestedFacets.length === 2);
  }
}

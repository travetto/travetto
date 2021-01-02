import * as assert from 'assert';

import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/test-support/base';
import { Suite, Test } from '@travetto/test';
import { SchemaFakerUtil } from '@travetto/schema';

import { Person } from './types';
import { ModelQueryFacetSupport } from '../src/service/facet';

@Suite()
export class ModelQueryFacetSuite extends BaseModelSuite<ModelQueryFacetSupport & ModelCrudSupport> {

  private async loadPeople() {
    const names = ['Bob', 'Bo', 'Barry', 'Rob', 'Robert', 'Robbie'];
    const people = [0, 1, 2, 3, 4, 5].map(x =>
      Person.from({
        name: names[x],
        age: 20 + x,
        gender: 'm',
        address: {
          street1: 'a',
          ...(x === 1 ? { street2: 'b' } : {})
        }
      }));

    await this.saveAll(Person, people);
  }

  @Test('Verify value suggestion')
  async testSuggestion() {
    const service = await this.service;

    await this.loadPeople();

    let suggested = await service.suggestValues(Person, 'name', 'bo');
    assert(suggested.length === 2);

    suggested = await service.suggestValues(Person, 'name', 'b');
    assert(suggested.length === 3);

    suggested = await service.suggestValues(Person, 'name', 'b', {
      where: {
        address: {
          street2: {
            $exists: true
          }
        }
      }
    });
    assert(suggested.length === 1);
  }

  @Test('Verify suggested entities')
  async verifyEntities() {
    const service = await this.service;

    await this.loadPeople();

    const suggestedEntities = await service.suggest(Person, 'name', 'bo');

    assert(suggestedEntities.length === 2);
    assert(suggestedEntities[0].name === 'Bo');
    assert(suggestedEntities[1].name === 'Bob');
    assert(suggestedEntities[0] instanceof Person);
    assert(suggestedEntities[1] instanceof Person);
  }

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

    const genders = { m: 0, f: 0 };
    for (const el of people) {
      genders[el.gender] += 1;
    }

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
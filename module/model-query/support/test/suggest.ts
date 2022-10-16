import * as assert from 'assert';

import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { Suite, Test } from '@travetto/test';

import { Person } from './types';
import { ModelQuerySuggestSupport } from '../../src/service/suggest';

@Suite()
export abstract class ModelQuerySuggestSuite extends BaseModelSuite<ModelQuerySuggestSupport & ModelCrudSupport> {

  async #loadPeople() {
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

    await this.#loadPeople();

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

    await this.#loadPeople();

    const suggestedEntities = await service.suggest(Person, 'name', 'bo');

    assert(suggestedEntities.length === 2);
    assert(suggestedEntities[0].name === 'Bo');
    assert(suggestedEntities[1].name === 'Bob');
    assert(suggestedEntities[0] instanceof Person);
    assert(suggestedEntities[1] instanceof Person);
  }
}
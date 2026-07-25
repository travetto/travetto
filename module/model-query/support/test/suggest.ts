import assert from 'node:assert';

import type { ModelCrudSupport } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelQuerySuggestSupport } from '../../src/types/suggest.ts';
import { Person, WithNestedLists, WithNestedNestedLists } from './model.ts';

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
      })
    );

    await this.saveAll(Person, people);
  }

  async #loadNestedLists() {
    await this.saveAll(WithNestedLists, [
      WithNestedLists.from({ tags: ['apple', 'banana', 'apricot'], names: ['alex', 'amber'] }),
      WithNestedLists.from({ tags: ['blueberry', 'avocado'], names: ['bob', 'bill'] }),
      WithNestedLists.from({ tags: ['cherry', 'date'], names: ['charlie'] })
    ]);
  }

  async #loadNestedNestedLists() {
    await this.saveAll(WithNestedNestedLists, [
      WithNestedNestedLists.from({ tags: ['apple', 'banana'], sub: { names: ['alex', 'amber'] } }),
      WithNestedNestedLists.from({ tags: ['blueberry'], sub: { names: ['avocado', 'bill'] } }),
      WithNestedNestedLists.from({ tags: ['cherry'], sub: { names: ['charlie'] } }),
      WithNestedNestedLists.from({ tags: ['date'] })
    ]);
  }

  @Test('Verify value suggestion')
  async testSuggestion() {
    const service = await this.service;

    await this.#loadPeople();

    let suggested = await service.suggestValuesByQuery(Person, 'name', 'bo');
    assert(suggested.length === 2);

    suggested = await service.suggestValuesByQuery(Person, 'name', 'b');
    assert(suggested.length === 3);

    suggested = await service.suggestValuesByQuery(Person, 'name', 'b', {
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

    const suggestedEntities = await service.suggestByQuery(Person, 'name', 'bo');

    assert(suggestedEntities.length === 2);
    assert(suggestedEntities[0].name === 'Bo');
    assert(suggestedEntities[1].name === 'Bob');
    assert(suggestedEntities[0] instanceof Person);
    assert(suggestedEntities[1] instanceof Person);
  }

  @Test('Verify suggestion on string arrays')
  async verifyStringArraySuggestions() {
    const service = await this.service;

    await this.#loadNestedLists();

    const suggestedValues = await service.suggestValuesByQuery(WithNestedLists, 'tags', 'ap');
    assert(suggestedValues.length === 2);
    assert(suggestedValues[0] === 'apple');
    assert(suggestedValues[1] === 'apricot');

    const suggestedEntities = await service.suggestByQuery(WithNestedLists, 'tags', 'ap');
    assert(suggestedEntities.length === 1);
    assert(suggestedEntities[0] instanceof WithNestedLists);
    assert(suggestedEntities[0].tags?.includes('apple'));
  }

  @Test('Verify suggestion on nested string arrays')
  async verifyNestedStringArraySuggestions() {
    const service = await this.service;

    await this.#loadNestedNestedLists();

    const suggestedValues = await service.suggestValuesByQuery(WithNestedNestedLists, 'sub.names', 'a');
    assert(suggestedValues.length === 3);
    assert(suggestedValues[0] === 'alex');
    assert(suggestedValues[1] === 'amber');
    assert(suggestedValues[2] === 'avocado');

    const suggestedEntities = await service.suggestByQuery(WithNestedNestedLists, 'sub.names', 'al');
    assert(suggestedEntities.length === 1);
    assert(suggestedEntities[0] instanceof WithNestedNestedLists);
    assert(suggestedEntities[0].sub?.names?.includes('alex'));
  }
}

import { SchemaBound, View } from '@travetto/schema';
import { Model, ModelService, WhereClause, PageableModelQuery, Query, MatchQuery } from '../index';
import { TestSource } from './registry';
import { Person, Address } from './models';
import { Test, Suite, BeforeAll } from '@travetto/test';

import * as assert from 'assert';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry, Class } from '@travetto/registry';

const query: Query<Person> = {
  /*select: {
    address: {
      street1: 1
    }
  },
  sort: [{
    address: {
      street1: -1
    }
  }],*/
  where: {
    name: '5',
    names: ['1', '2'],
    dob: {
      $in: [new Date()]
    },
    address: {
      street2: {
        $eq: '5'
      }
    }
  }
}

@Suite()
class DataBinding {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  validateBind() {
    const person = Person.from({
      name: 'Test',
      address: {
        street1: '1234 Fun',
        street2: 'Unit 20'
      }
    });

    assert(person.address instanceof Address);
    assert(person.address.street1 === '1234 Fun');
  }

  @Test()
  async getModel() {
    const model = await DependencyRegistry.getInstance(ModelService);

    assert(model['source'] instanceof TestSource);

    const res = await model.getByQuery(Person, {
      where: {
        $and: [{
          name: '5',
          address: {
            street1: {
              $nin: ['5']
            }
          }
        }, {
          $or: [{
            age: {
              $in: [5]
            }
          }],
        }]
      }
    });
  }
}
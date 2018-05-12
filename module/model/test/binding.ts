import { SchemaBound, View } from '@travetto/schema';
import { Model, ModelService, WhereClause, PageableModelQuery, Query, MatchQuery } from '../index';
import { TestSource } from './registry';
import { Person, Address } from './models';
import { Test, Suite, BeforeAll } from '@travetto/test';

import * as assert from 'assert';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry, Class } from '@travetto/registry';

const street1 = '1234 Fun';

@Suite('Binding Test')
class DataBinding {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test('Binding Test One')
  validateBind() {
    const person = Person.from({
      name: 'Test',
      address: {
        street1,
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

    try {
      const res = await model.getByQuery(Person, {
        where: {
          $and: [{
            name: '5',
            dob: {
              $eq: new Date()
            }
          }, {
            name: '8',
            address: {
              street1: {
                $nin: ['10']
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
    } catch (e) {
      assert(e instanceof Error);
      assert(e.message === 'Method not implemented.');
    }
  }
}
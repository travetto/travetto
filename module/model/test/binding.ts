import { SchemaBound, View } from '@travetto/schema';
import { Model, ModelService, WhereClause, PageableModelQuery, ModelQuery, Query } from '../index';
import { TestSource } from './registry';
import { Person, Address } from './models';
import { Test, Suite, BeforeAll } from '@travetto/test';

import * as assert from 'assert';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry, Class } from '@travetto/registry';


let query: Query<Person> = {
  select: {
    address: {
      street1: -5
    }
  },
  sort: {
    address: {
      street1: 1
    }
  },
  where: {
    name: 'orange',
    names: ['1', '2'],
    dob: {
      $in: [
        new Date(), 5
      ],
    },
    address: {
      street2: {
        $eq: 'a'
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
    let person = Person.from({
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

    let model = await DependencyRegistry.getInstance(ModelService);
    assert(model['source'] instanceof TestSource);

    let res = await model.getByQuery(Person, {
      where: {
        name: 'orange',
        names: ['1', '2'],
        dob: {
          $in: [
            new Date(), 5
          ],
        },
        address: {
          street2: {
            $eq: 'a'
          }
        }
      }
    });
  }
}
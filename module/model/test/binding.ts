import * as assert from 'assert';

import { DependencyRegistry } from '@travetto/di';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { SchemaRegistry } from '@travetto/schema';

import { TestSource } from './registry';
import { Person, Address } from './models';

import { ModelService, ModelRegistry } from '../';

const street1 = '1234 Fun';

@Suite('Binding Test')
class DataBinding {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
    await ModelRegistry.init();
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
      await model.getByQuery(Person, {
        where: {
          $and: [
            {
              address: {
                street1: {
                  $eq: '5'
                }
              }
            }
          ]
        }
      });
    } catch (e) {
      assert(e instanceof Error);
      assert(e.message === 'Method not implemented.');
    }
  }
}
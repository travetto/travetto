import * as assert from 'assert';

import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { Test, Suite, BeforeAll } from '@travetto/test';

import { TestSource } from './registry';
import { Person, Address } from './models';

import { ModelService } from '../';

const street1 = '1234 Fun';

@Suite('Binding Test')
class DataBinding {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
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
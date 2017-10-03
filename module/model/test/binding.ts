import { SchemaBound, View } from '@travetto/schema';
import { Model, ModelService } from '../index';
import { TestSource } from './registry';
import { Person, Address } from './models';
import { Test, Suite, BeforeAll } from '@travetto/test';

import * as assert from 'assert';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

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
    console.log(person);
    assert(person.address instanceof Address);
    assert(person.address.street1 === '1234 Fun');

  }

  @Test()
  async getModel() {
    let model = await DependencyRegistry.getInstance(ModelService);
    assert(model['source'] instanceof TestSource);
  }
}
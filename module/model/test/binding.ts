import 'mocha';

import { SchemaBound, View } from '@encore2/schema';
import { expect } from 'chai';
import { Model, ModelService, ModelSource, Query, BulkState, BulkResponse, QueryOptions } from '../index';
import { Class } from '@encore2/registry';

@Model()
class Address extends SchemaBound {

  @View('test')
  street1: string;

  street2: string;
}

@Model()
class Person extends SchemaBound {
  name: string;
  address: Address;
}

describe('Data Binding', () => {
  it('Validate bind', () => {
    let person = Person.from({
      name: 'Test',
      address: {
        street1: '1234 Fun',
        street2: 'Unit 20'
      }
    });
    expect(person.address).instanceof(Address);
    expect(person.address.street1).to.equal('1234 Fun');
  });
});
import 'mocha';

import { SchemaBound, View } from '@encore2/schema';
import { expect } from 'chai';
import { Model, ModelService } from '../index';
import { TestSource } from './registry';
import { Person, Address } from './models';


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
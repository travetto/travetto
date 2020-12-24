import { Person } from './person';
import { SchemaValidator } from '../../../src/validate/validator';

export async function validate() {

  const person = Person.from({
    name: 'Test',
    // @ts-ignore
    age: 'abc',
    address: {
      street1: '1234 Fun'
    }
  });

  await SchemaValidator.validate(Person, person);
}
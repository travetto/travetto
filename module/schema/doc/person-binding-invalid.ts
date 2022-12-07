import { SchemaValidator } from '@travetto/schema';

import { Person } from './person';

export async function validate(): Promise<void> {

  const person = Person.from({
    name: 'Test',
    // @ts-expect-error
    age: 'abc',
    address: {
      street1: '1234 Fun'
    }
  });

  await SchemaValidator.validate(Person, person);
}
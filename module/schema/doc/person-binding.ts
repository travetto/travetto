import { Person } from './person';

export function Test(): Person {
  return Person.from({
    name: 'Test',
    age: 19.999978,
    address: {
      street1: '1234 Fun',
      street2: 'Unit 20'
    }
  });
}
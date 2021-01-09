import { Person } from './person';

export function Test() {
  return Person.from({
    name: 'Test',
    age: 19.999978,
    address: {
      street1: '1234 Fun',
      street2: 'Unit 20'
    }
  });
}
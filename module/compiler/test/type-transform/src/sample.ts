import { Simple, Concrete } from './types';

export class Container {
  static simpleAdd(a: number, b?: number) {
    return a + (b ?? 0);
  }

  special = /a/;

  rating: 1 | 2 | 3 | 4 | 5 = 1;

  ageIt(person: Simple) {
    person.age = (person.age ?? 0) + 1;
  }

  scoring(scores: ['a' | 'b' | 'c', number, number]) {
    return scores.length;
  }

  conc(val: Concrete) {
    console.log('WOOHOO', val);
  }
}
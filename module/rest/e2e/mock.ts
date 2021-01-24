import { Injectable } from '@travetto/di';

class User {
  constructor(public first: string, public last: string, public middle?: string) { }
}

@Injectable()
export class MockService {

  private count = 0;

  fetch2() {
    return new User('Goodbye', 'Cruel', 'World');
  }

  fetch() {
    return new User(
      `Hello-${this.count++}`,
      'World',
      '!!!'
    );
  }
}
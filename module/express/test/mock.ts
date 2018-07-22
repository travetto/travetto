import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';

class User {
  constructor(public first: string, public last: string, public middle?: string) { }
}

@Injectable()
export class MockService {

  private count = 0;

  @Inject()
  private context: Context;

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
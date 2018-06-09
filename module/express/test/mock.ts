import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';

class User {
  constructor(public first: string, public last: string, public middle?: string) { }
}

@Injectable()
export class MockService {

  @Inject()
  private context: Context;

  fetch2() {
    return new User('Bob', 'zrdb', 'EzBake Ovesnz3');
  }

  fetch() {
    return new User('jasmine-brob', 'zrde', this.context.get().name || 'EzBake Ovesnz3');
  }
}
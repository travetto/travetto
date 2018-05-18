import { Injectable } from '@travetto/di';

class User {
  constructor(public first: string, public last: string, public middle?: string) { }
}

@Injectable()
export class MockService {
  fetch2() {
    return new User('Bob', 'zrdb', 'EzBake Ovesnz3');
  }

  fetch() {
    return new User('jasmine-brob', 'zrde', 'EzBake Ovesnz3');
  }
}
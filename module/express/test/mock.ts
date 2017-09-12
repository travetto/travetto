import { Injectable } from '@encore2/di';


class User {
  constructor(public first: string, public last: string, public middle?: string) { }
}

@Injectable()
export class MockService {

  fetch() {
    return new User('Abcdf', 'Zd', 'EzBake Ovenz2');
  }
}
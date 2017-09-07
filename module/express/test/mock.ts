import { Injectable } from '@encore2/di';


@Injectable()
export class MockService {

  fetch() {
    return {
      first: 'A',
      last: 'Z',
      middle: 'EzBake Oven'
    };
  }
}
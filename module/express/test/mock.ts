import { Injectable } from '@encore/di';


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
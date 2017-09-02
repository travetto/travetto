import { Injectable } from '@encore/di';

@Injectable()
export class Test {
  postConstruct() {
    console.log('Howdy');
  }
}
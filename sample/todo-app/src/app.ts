import { Application } from '@travetto/di';

@Application('rest2', { watchable: false })
export class App {
  constructor() {

  }

  run() {
    console.log('howdy');
  }
}
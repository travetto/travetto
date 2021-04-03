import { Application } from '@travetto/app';
import { RestApplication } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  #app: RestApplication;

  constructor(app: RestApplication) {
    this.#app = app;
  }

  run() {
    return this.#app.run();
  }
}
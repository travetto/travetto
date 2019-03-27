import { Application, RestApp } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
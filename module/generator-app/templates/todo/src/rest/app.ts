import { Application, RestApp } from '@travetto/rest';

@Application('{{app.name}}')
export class SampleApp {

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
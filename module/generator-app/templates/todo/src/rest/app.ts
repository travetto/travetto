import { Application } from '@travetto/di';
import { RestApp } from '@travetto/rest';

@Application('{{app_name}}')
export class SampleApp {

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
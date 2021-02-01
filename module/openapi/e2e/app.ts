import { Application } from '@travetto/app';
import { RestApplication } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private app: RestApplication) { }

  run() {
    return this.app.run();
  }
}
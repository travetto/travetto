import { Application } from '@travetto/app';
import { RestServer } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private app: RestServer) { }

  run() {
    return this.app.run();
  }
}
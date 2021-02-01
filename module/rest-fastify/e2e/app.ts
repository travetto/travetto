import { Application } from '@travetto/app';
import { RestConfig, RestApplication } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private server: RestApplication, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl.active = false;
    return this.server.run();
  }
}
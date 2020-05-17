import { Application } from '@travetto/app';
import { RestConfig, RestServer } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private server: RestServer, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl.active = false;
    return this.server.run();
  }
}
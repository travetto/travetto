import { RestConfig, Application, RestApp } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private server: RestApp, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl = false;
    this.server.run();
  }
}
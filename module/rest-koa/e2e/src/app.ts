import { RestConfig, Application, RestApp } from '@travetto/rest';

@Application('sample')
export class SampleApp {

  constructor(private server: RestApp, private config: RestConfig) { }

  run(port = 3000, ssl = false) {
    this.config.port = port;
    this.config.ssl.active = ssl;
    this.server.run();
  }
}
import { Application } from '@travetto/app';
import { RestConfig, RestApplication } from '@travetto/rest';

@Application('sample')
export class SampleApp {
  #server: RestApplication;
  #config: RestConfig;

  constructor(server: RestApplication, config: RestConfig) { }

  run(port = 3000, ssl = false) {
    this.#config.port = port;
    this.#config.ssl.active = ssl;
    return this.#server.run();
  }
}
import { Application } from '@travetto/app';
import { RestConfig, RestApplication } from '@travetto/rest';

@Application('sample')
export class SampleApp {
  #server: RestApplication;
  #config: RestConfig;

  constructor(server: RestApplication, config: RestConfig) {
    this.#server = server;
    this.#config = config;
  }

  run() {
    this.#config.port = 3000;
    this.#config.ssl.active = false;
    return this.#server.run();
  }
}
import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { FastifyRestApp } from '../../src/app';
import { RestConfig } from '@travetto/rest/src/config';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new FastifyRestApp();
  }

  constructor(private server: RestServer, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl = false;
    this.server.run();
  }
}
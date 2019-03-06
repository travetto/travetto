import { InjectableFactory } from '@travetto/di';
import { RestConfig, Application, RestApp } from '@travetto/rest';
import { FastifyRestApp } from '../../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new FastifyRestApp();
  }

  constructor(private server: RestApp, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl = false;
    this.server.run();
  }
}
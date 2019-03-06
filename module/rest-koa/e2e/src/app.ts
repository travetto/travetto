import { InjectableFactory } from '@travetto/di';
import { RestConfig, Application, RestApp } from '@travetto/rest';
import { KoaRestApp } from '../../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }

  constructor(private server: RestApp, private config: RestConfig) { }

  run(port = 3000, ssl = false) {
    this.config.port = port;
    this.config.ssl = ssl;
    this.server.run();
  }
}
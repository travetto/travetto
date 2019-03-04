import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { KoaRestApp } from '../../src/provider';
import { RestConfig } from '@travetto/rest/src/config';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }

  constructor(private server: RestServer, private config: RestConfig) { }

  run(port = 3000, ssl = false) {
    this.config.port = port;
    this.config.ssl = ssl;
    this.server.run();
  }
}
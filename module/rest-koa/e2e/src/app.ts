import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { RestKoaAppProvider } from '../../src/provider';
import { RestConfig } from '@travetto/rest/src/config';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestKoaAppProvider();
  }

  constructor(private app: RestApp, private config: RestConfig) { }

  run(port = 3000, ssl = false) {
    this.config.port = port;
    this.config.ssl = ssl;
    this.app.run();
  }
}
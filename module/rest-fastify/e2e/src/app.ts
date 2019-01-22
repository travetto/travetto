import { Application, InjectableFactory, Inject } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { RestFastifyAppProvider } from '../../src/provider';
import { RestConfig } from '@travetto/rest/src/config';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestFastifyAppProvider();
  }

  constructor(private app: RestApp, private config: RestConfig) { }

  run() {
    this.config.port = 3000;
    this.config.ssl = false;
    this.app.run();
  }
}
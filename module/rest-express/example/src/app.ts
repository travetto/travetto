import { InjectableFactory } from '@travetto/di';
import { Application, RestApp, RestConfig, RestAppProvider } from '@travetto/rest';
import { RestExpressAppProvider } from '../../src/provider';

@Application('sample', {
  description: 'Sample rest application'
})
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestExpressAppProvider();
  }

  constructor(
    private app: RestApp,
    private config: RestConfig
  ) { }

  run(port = 3000, ssl = false) {
    this.config.port = port;
    this.config.ssl = ssl;
    this.app.run();
  }
}
import { InjectableFactory } from '@travetto/di';
import { Application, RestServer, RestConfig, RestApp } from '@travetto/rest';
import { ExpressRestApp } from '../../src/app';

@Application('sample', {
  description: 'Sample rest application'
})
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new ExpressRestApp();
  }

  constructor(
    private server: RestServer,
    private config: RestConfig
  ) { }

  run(port = 3000, ssl = false, fast?: string, toggle?: 'on' | 'off') {
    this.config.port = port;
    this.config.ssl = ssl;
    this.server.run();
  }
}
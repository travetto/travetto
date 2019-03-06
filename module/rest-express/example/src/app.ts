import { InjectableFactory } from '@travetto/di';
import { Application, RestConfig, RestApp } from '@travetto/rest';
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
    private app: RestApp,
    private config: RestConfig
  ) { }

  run(port = 3000, ssl = false, fast?: string, toggle?: 'on' | 'off') {
    this.config.port = port;
    this.config.ssl = ssl;
    this.app.run();
  }
}
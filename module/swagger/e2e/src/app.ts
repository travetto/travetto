import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { RestExpressAppProvider } from '@travetto/rest-express';

export * from '../../src/controller'; // Force loading, and bypass no-side-effect

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getRestApp(): RestAppProvider {
    return new RestExpressAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
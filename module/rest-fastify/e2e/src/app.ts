import { Application, InjectableFactory, Inject } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { FastifyAppProvider } from '../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new FastifyAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
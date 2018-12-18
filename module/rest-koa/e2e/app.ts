import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { RestKoaAppProvider } from '../src/provider';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestKoaAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
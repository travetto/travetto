import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { KoaAppProvider } from '@travetto/rest-koa';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new KoaAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
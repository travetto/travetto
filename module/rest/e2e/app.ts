import { Application, InjectableFactory, Inject } from '@travetto/di';
import { RestApp, RestAppProvider } from '../src';
import { ExpressAppProvider } from '../extension/express/express';
import { ContextInterceptor } from '../extension/context';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new ExpressAppProvider();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
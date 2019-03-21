import { Application, InjectableFactory, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest.ext';

import { RouteConfig, RestApp, RestInterceptor, RestAppCustomizer } from '../..';

type Inner = {
  use(factory: any): void;
};

class DummyApp extends RestApp<Inner> {
  raw: any = {};

  async createRaw() {
    return {
      use(val: any) {
        console.log('Using', val);
      }
    };
  }

  listen() {
    console.log('Listening');
  }

  async registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[]) {
    console.log('Registering Controller', path, endpoints.length);
  }

  registerInterceptor(inter: RestInterceptor) {
    console.log('Registering Interceptor', inter.constructor.name);
  }

  async unregisterRoutes(key: string | symbol) {
    console.log('Un-registering global');
  }
}

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp<Inner> {
    return new DummyApp();
  }

  @InjectableFactory()
  static getCustomer(): RestAppCustomizer<Inner> {
    return new class extends RestAppCustomizer<Inner> {
      customize(app: Inner) {
        console.log('Hello');
        app.use('something');
      }
    }();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestApp) { }

  async run() {
    await this.app.run();
  }
}
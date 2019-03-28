import { InjectableFactory, Injectable } from '@travetto/di';

import { Application, RouteConfig, RestApp, RestInterceptor, RestAppCustomizer } from '../..';

type Inner = {
  use(factory: any): void;
};

@Injectable()
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
  static getCustomer(): RestAppCustomizer<Inner> {
    return new class extends RestAppCustomizer<Inner> {
      customize(app: Inner) {
        console.log('Hello');
        app.use('something');
      }
    }();
  }

  constructor(private app: RestApp) { }

  async run() {
    await this.app.run();
  }
}
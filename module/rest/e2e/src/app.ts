import { InjectableFactory, Injectable } from '@travetto/di';

import { Application, RouteConfig, RestApp, RestInterceptor } from '../..';

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

  constructor(private app: RestApp) { }

  async run() {
    await this.app.run();
  }
}
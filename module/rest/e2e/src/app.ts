import { Application, InjectableFactory, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest';

import { RouteConfig, RestApp, RestInterceptor } from '../..';

class DummyApp extends RestApp {
  raw: any = {};

  async createRaw() { }

  async init() {
    console.log('Initializing');
  }

  listen() {
    console.log('Listening');
  }

  async registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[]) {
    console.log('Registering Controller', path, endpoints);
  }

  registerInterceptor(inter: RestInterceptor) {
    console.log('Registering Interceptor', inter);
  }

  async unregisterRoutes(key: string | symbol) {
    console.log('Un-registering global');
  }
}

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new DummyApp();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
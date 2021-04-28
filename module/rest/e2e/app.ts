import { Inject, Injectable } from '@travetto/di';
import { Application } from '@travetto/app';

import { RestApplication, ServerHandle, RouteConfig, RestServer, RestInterceptor } from '..';

type Inner = {
  use(factory: unknown): void;
};

@Injectable()
class DummyServer implements RestServer<Inner> {

  listening = false;

  raw: Inner;

  async init() {
    return {
      use(val: unknown) {
        console.log('Using', { val: val as string });
      }
    };
  }

  listen() {
    console.log('Listening');
    this.listening = true;
    return {} as ServerHandle;
  }

  async registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[]) {
    console.log('Registering Controller', { path, endpoints: endpoints.length });
  }

  registerInterceptor(inter: RestInterceptor) {
    console.log('Registering Interceptor', { name: inter.constructor.name });
  }

  async unregisterRoutes(key: string | symbol) {
    console.log('Un-registering global');
  }
}

@Application('sample')
export class SampleApp {

  @Inject()
  app: RestApplication;

  run() {
    return this.app.run();
  }
}
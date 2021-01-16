import { Injectable } from '@travetto/di';
import { Application } from '@travetto/app';
import { RouteConfig, RestServer, RestInterceptor } from '..';
import { ServerHandle } from '../src/types';

type Inner = {
  use(factory: unknown): void;
};

@Injectable()
class DummyServer extends RestServer<Inner> {
  raw: Inner;

  async createRaw() {
    return {
      use(val: unknown) {
        console.log('Using', { val });
      }
    };
  }

  listen() {
    console.log('Listening');
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

  constructor(private app: RestServer) { }

  async run() {
    return this.app.run();
  }
}
import { Injectable } from '@travetto/di';
import { Application } from '@travetto/app';
import { RouteConfig, RestServer, RestInterceptor } from '../../..';
import { ServerHandle } from '../../../src/types';

type Inner = {
  use(factory: any): void;
};

@Injectable()
class DummyServer extends RestServer<Inner> {
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
    return {} as ServerHandle;
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

  constructor(private app: RestServer) { }

  async run() {
    return this.app.run();
  }
}
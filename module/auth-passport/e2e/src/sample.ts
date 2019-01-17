import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { FastifyAppProvider } from '@travetto/rest-fastify';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new FastifyAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
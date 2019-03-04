import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { FastifyRestApp } from '@travetto/rest-fastify';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new FastifyRestApp();
  }

  constructor(private server: RestServer) { }

  run() {
    this.server.run();
  }
}
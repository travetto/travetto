import { Application, InjectableFactory } from '@travetto/di';
import { RestApp } from '@travetto/rest';
import { FastifyRestApp } from '@travetto/rest-fastify';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getApp(): RestApp {
    return new FastifyRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
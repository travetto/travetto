import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { ExpressRestApp } from '@travetto/rest-express';

export * from '../../src/controller'; // Force loading, and bypass no-side-effect

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getRestApp(): RestApp {
    return new ExpressRestApp();
  }

  constructor(private server: RestServer) { }

  run() {
    this.server.run();
  }
}
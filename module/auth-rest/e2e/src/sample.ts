import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { KoaRestApp } from '@travetto/rest-koa';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }

  constructor(private server: RestServer) { }

  run() {
    this.server.run();
  }
}
import { Application, InjectableFactory } from '@travetto/di';
import { RestApp } from '@travetto/rest';
import { KoaRestApp } from '@travetto/rest-koa';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
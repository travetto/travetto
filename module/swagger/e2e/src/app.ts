import { Application, InjectableFactory } from '@travetto/di';
import { RestApp } from '@travetto/rest';
import { ExpressRestApp } from '@travetto/rest-express';

@Application('sample', { standalone: false })
export class SampleApp {

  @InjectableFactory()
  static getApp(): RestApp {
    return new ExpressRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
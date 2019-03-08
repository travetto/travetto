import { Inject, InjectableFactory } from '@travetto/di';
import { Application, RestApp } from '@travetto/rest';
import { ExpressRestApp } from '@travetto/rest-express';

@Application('todo')
export class TodoApp {

  @InjectableFactory()
  static appProvider(): RestApp {
    return new ExpressRestApp();
  }

  @Inject()
  app: RestApp;

  run() {
    this.app.run();
  }
}
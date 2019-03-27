import { Inject } from '@travetto/di';
import { Application, RestApp } from '@travetto/rest';

@Application('todo')
export class TodoApp {

  @Inject()
  app: RestApp;

  run() {
    this.app.run();
  }
}
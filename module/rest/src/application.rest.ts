import { Application } from './decorator/application';
import { RestApp } from './app';

@Application('rest')
class EntryPoint {
  constructor(private app: RestApp) { }
  run() {
    return this.app.run();
  }
}
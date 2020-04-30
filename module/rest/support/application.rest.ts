import { Application } from '../src/decorator/application';
import { RestApp } from '../src/app';

@Application('rest')
// TODO: Document
class EntryPoint {
  constructor(private app: RestApp) { }
  run() {
    return this.app.run();
  }
}
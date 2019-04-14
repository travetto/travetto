import { Application } from '@travetto/di';
import { RestApp } from '@travetto/rest';

@Application('sample', { standalone: false })
export class SampleApp {

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
import { Application } from '@travetto/di';
import { ExpressApp } from '@travetto/express';

@Application('sample')
export class SampleApp {

  constructor(private app: ExpressApp) { }

  run() {
    this.app.run();
  }
}
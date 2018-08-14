import { Application } from '@travetto/di';
import { ExpressApp } from '@travetto/express';

import { ClientGenerate } from '../src';

@Application('sample')
export class SampleApp {

  constructor(private app: ExpressApp, private cg: ClientGenerate) { }

  run() {
    this.app.run();
  }
}
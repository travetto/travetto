import { Application } from '@travetto/di';
import { RestApp } from '@travetto/rest';

import { ClientGenerate } from '../src';

@Application('sample')
export class SampleApp {

  constructor(private app: RestApp, private cg: ClientGenerate) { }

  run() {
    this.app.run();
  }
}
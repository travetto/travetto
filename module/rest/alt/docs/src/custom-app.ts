import { Application } from '@travetto/app';

import { RestServer } from '../../../src/server/base';

@Application('custom')
export class SampleApp {

  constructor(private server: RestServer) { }

  run() {
    // Configure server before running

    return this.server.run();
  }
}
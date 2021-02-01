import { Application } from '@travetto/app';
import { RestConfig, RestApplication } from '@travetto/rest';

@Application('sample', {
  description: 'Sample rest application'
})
export class SampleApp {

  constructor(
    private server: RestApplication,
    private config: RestConfig
  ) { }

  run(port = 3000, ssl = false, fast?: string, toggle?: 'on' | 'off') {
    this.config.port = port;
    this.config.ssl.active = ssl;
    return this.server.run();
  }
}
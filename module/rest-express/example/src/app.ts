import { Application, RestConfig, RestApp } from '@travetto/rest';

@Application('sample', {
  description: 'Sample rest application'
})
export class SampleApp {

  constructor(
    private app: RestApp,
    private config: RestConfig
  ) { }

  run(port = 3000, ssl = false, fast?: string, toggle?: 'on' | 'off') {
    this.config.port = port;
    this.config.ssl.active = ssl;
    this.app.run();
  }
}
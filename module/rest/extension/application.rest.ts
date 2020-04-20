import { Application } from '@travetto/app';
import { RestApp } from '../src/app';

@Application('rest')
class EntryPoint {
  constructor(private app: RestApp) { }
  run(port?: number) {
    if (port) {
      this.app.config.port = port;
    }
    return this.app.run();
  }
}
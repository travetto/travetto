import { RestApp } from '../src/app';
import { Application } from '@travetto/app';

/**
 * Default application entrypoint
 */
@Application('rest', { watchable: true })
class EntryPoint {
  constructor(private app: RestApp) { }
  run() {
    return this.app.run();
  }
}
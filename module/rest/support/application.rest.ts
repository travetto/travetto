import { Application } from '@travetto/app';
import { RestServer } from '../src/server/server';

/**
 * Default application entrypoint
 */
@Application('rest', { watchable: true })
class EntryPoint {
  constructor(private server: RestServer) { }
  run() {
    return this.server.run();
  }
}
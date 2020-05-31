import { Application } from '@travetto/app';
import { RestServer } from '../src/server/server';

/**
 * Default application entrypoint
 */
@Application('rest', {
  description: 'Default rest application entrypoint'
})
class EntryPoint {
  constructor(private server: RestServer) { }
  run() {
    return this.server.run();
  }
}
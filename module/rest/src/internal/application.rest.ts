import { Application } from '@travetto/app';
import { RestServer } from '../server/base';

/**
 * Default application entrypoint
 */
@Application('rest', {
  description: 'Default rest application entrypoint'
})
export class DefaultRestApplication {
  constructor(private server: RestServer) { }
  async run() {
    return this.server.run();
  }
}
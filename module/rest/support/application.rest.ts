import { Application } from '@travetto/app';
import { RestServer } from '../src/server/server';

/**
 * Default application entrypoint
 */
@Application('rest', {
  description: 'Default rest application entrypoint'
})
export class DefaultRestApplication {
  constructor(private server: RestServer) { }
  async run() {
    const handle = await this.server.run();
    return {
      close: () => new Promise<void>(res => handle.close(() => res())),
      wait: () => new Promise<void>(res => handle.on('close', res))
    };
  }
}
import { Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { NetUtil } from '@travetto/web';
import { Registry } from '@travetto/registry';

import type { WebHttpServer } from '../src/types.ts';

/**
 * Run a web server
 */
@CliCommand({ runTarget: true, with: { debugIpc: 'optional', restartOnChange: true, module: true, profiles: true } })
export class WebHttpCommand implements CliCommandShape {

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean = Runtime.localDevelopment;

  preMain(): void {
    if (this.port) {
      process.env.WEB_HTTP_PORT = `${this.port}`;
    }
  }

  async main(): Promise<void> {
    await Registry.init();
    const instance = await DependencyRegistryIndex.getInstance(toConcrete<WebHttpServer>());

    try {
      const handle = await instance.serve();
      return handle.complete;
    } catch (err) {
      const result = this.killConflict ? await NetUtil.freePortOnConflict(err) : undefined;
      if (result?.processId) {
        console.warn('Killed process owning port', result);
        process.exitCode = 1; // Indicate error, restart will use if in that mode
        return;
      }
      throw err;
    }
  }
}
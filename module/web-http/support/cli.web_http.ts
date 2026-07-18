import { CliCommand, type CliCommandShape, CliDebugIpcFlag, CliModuleFlag, CliProfilesFlag, CliRestartOnChangeFlag } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Runtime, toConcrete } from '@travetto/runtime';
import { NetUtil } from '@travetto/web';

import type { WebHttpServer } from '../src/types.ts';

/**
 * Start the configured web HTTP server for a module.
 *
 * Initializes registry and server bindings, supports restart-aware development
 * flags, and can attempt to clear conflicting port owners in local workflows.
 *
 * @example
 * Starting a web server on port 8000
 * > trv web:http -m <MODULE> -p 8000
 */
@CliCommand()
export class WebHttpCommand implements CliCommandShape {
  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean = Runtime.localDevelopment;

  @CliModuleFlag({ short: 'm' })
  module: string;

  @CliProfilesFlag()
  profile: string[];

  @CliRestartOnChangeFlag()
  restartOnChange: boolean = Runtime.localDevelopment;

  @CliDebugIpcFlag()
  debugIpc?: boolean;

  finalize(): void {
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

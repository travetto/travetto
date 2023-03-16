import { Closeable, GlobalEnvConfig, ShutdownManager } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { Schema, ValidationError } from '@travetto/schema';

import { RootRegistry } from '../src/service/root';

/** A pattern that can be waited on */
export type Waitable = { wait(): Promise<unknown> } | { on(event: 'close', cb: Function): unknown };

type RunResponse = Waitable | Closeable | void | undefined;

/**
 * Base for runnable applications
 */
@Schema()
export abstract class BaseRunCommand {

  /** Application environment */
  env?: string;

  /** Additional application profiles */
  profile: string[] = [];

  /** Module to run for */
  module?: string;

  envSet?(): Record<string, string | boolean | number>;

  envInit(): GlobalEnvConfig {
    return {
      debug: process.env.DEBUG || false,
      envName: this.env,
      profiles: this.profile,
      set: {
        TRV_INTRO_MESSAGE: true,
        ...this.envSet?.() ?? {}
      }
    };
  }

  async validate(): Promise<ValidationError | undefined> {
    if (!module && RootIndex.manifest.monoRepo && RootIndex.mainModule.sourcePath === RootIndex.manifest.workspacePath) {
      return {
        kind: 'required',
        path: 'module',
        message: 'Module is a required flag when running from a monorepo root'
      };
    }
  }

  /**
   * Wait for a response to finish
   * @param src
   */
  async run(src: () => (RunResponse | Promise<RunResponse>)): Promise<void> {
    if (this.module && this.module !== RootIndex.mainModule.name) { // Mono-repo support
      RootIndex.reinitForModule(this.module); // Reinit with specified module
    }
    await RootRegistry.init();

    const target = await src();
    if (target) {
      if ('close' in target) {
        ShutdownManager.onShutdown(target, target); // Tie shutdown into app close
      }
      if ('wait' in target) {
        await target.wait(); // Wait for close signal
      } else if ('on' in target) {
        await new Promise<void>(res => target.on('close', res));
      }
    }
  }
}
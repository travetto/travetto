import { ManifestModuleUtil } from '@travetto/manifest';
import { watchCompiler, WatchEvent, Runtime, RuntimeIndex } from '@travetto/runtime';

const VALID_FILE_TYPES = new Set(['js', 'ts']);

const handle = (err: Error): void => {
  if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
    console.error('Cannot find module', { error: err });
  } else {
    throw err;
  }
};

/**
 * Listens to file changes, and handles loading/unloading as needed (when supported)
 */
export class DynamicFileLoader {

  static async * listen(): AsyncIterable<WatchEvent> {
    // TODO: ESM Support?
    const { DynamicCommonjsLoader } = await import('./commonjs-loader.ts');
    const loader = new DynamicCommonjsLoader();
    await loader.init?.();

    process
      .on('unhandledRejection', handle)
      .on('uncaughtException', handle);

    // Fire off, and let it run in the bg. Restart on exit
    for await (const ev of watchCompiler({ restartOnExit: true })) {
      if (ev.file && RuntimeIndex.hasModule(ev.module) && VALID_FILE_TYPES.has(ManifestModuleUtil.getFileType(ev.file))) {
        if (ev.action === 'update' || ev.action === 'delete') {
          await loader.unload(ev.output);
        }
        if (ev.action === 'create' || ev.action === 'delete') {
          RuntimeIndex.reinitForModule(Runtime.main.name);
        }
        if (ev.action === 'create' || ev.action === 'update') {
          await loader.load(ev.output);
        }

        yield ev;
      }
    }
  }
}
import fs from 'fs/promises';

import { ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';

/**
 * `npx trv main`
 *
 * Allows for running of main entry points
 */
export class MainCommand extends CliCommand {

  name = 'main';

  getArgs(): string {
    return '<fileOrImport> [args...]';
  }

  async action(file: string, args: string[]): Promise<void> {
    try {
      // If referenced file exists
      if (await (fs.stat(path.resolve(file)).then(() => true, () => false))) {
        file = path.join(RootIndex.manifest.mainModule, file);
      }

      const imp = RootIndex.getFromImport(file)?.import;
      if (!imp) {
        throw new Error(`Unknown file: ${file}`);
      }

      const mod = await import(imp);
      await ShutdownManager.exitWithResponse(await mod.main(...args));
    } catch (err) {
      await ShutdownManager.exitWithResponse(err, true);
    }
  }
}
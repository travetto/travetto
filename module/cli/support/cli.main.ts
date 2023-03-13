import fs from 'fs/promises';

import { ShutdownManager } from '@travetto/base';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { ValidationError } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand()
export class MainCommand implements CliCommandShape {

  async #getImport(fileOrImport: string): Promise<string | undefined> {
    // If referenced file exists
    let file = fileOrImport;
    if (await (fs.stat(path.resolve(fileOrImport)).then(() => true, () => false))) {
      file = path.join(RootIndex.manifest.mainModule, fileOrImport);
    }

    return RootIndex.getFromImport(file)?.import;
  }

  async validate(fileOrImport: string): Promise<ValidationError | undefined> {
    const imp = await this.#getImport(fileOrImport);
    if (!imp) {
      return {
        message: `Unknown file: ${fileOrImport}`,
        kind: 'required',
        path: 'fileOrImport'
      };
    }
  }

  async main(fileOrImport: string, args: string[]): Promise<void> {
    try {
      const imp = await this.#getImport(fileOrImport);
      const mod = await import(imp!);
      await ShutdownManager.exitWithResponse(await mod.main(...args));
    } catch (err) {
      await ShutdownManager.exitWithResponse(err, true);
    }
  }
}
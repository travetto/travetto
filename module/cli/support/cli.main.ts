import fs from 'fs/promises';

import { ExecUtil } from '@travetto/base';
import { CliCommandShape, CliCommand, CliValidationError, ParsedState } from '@travetto/cli';
import { path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { Ignore } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand({ hidden: true })
export class MainCommand implements CliCommandShape {

  @Ignore()
  _parsed: ParsedState;

  async #getImport(fileOrImport: string): Promise<string | undefined> {
    // If referenced file exists
    let file = fileOrImport;
    if (await (fs.stat(path.resolve(fileOrImport)).then(() => true, () => false))) {
      file = path.join(RuntimeContext.mainModule, fileOrImport);
    }

    return RuntimeIndex.getFromImport(file)?.import;
  }

  async validate(fileOrImport: string): Promise<CliValidationError | undefined> {
    const imp = await this.#getImport(fileOrImport);
    if (!imp) {
      return { message: `Unknown file: ${fileOrImport}` };
    }
  }

  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    try {
      const imp = await this.#getImport(fileOrImport);
      const mod = await import(imp!);

      ExecUtil.sendResponse(await mod.main(...args, ...this._parsed.unknown));
    } catch (err) {
      ExecUtil.sendResponse(err, true);
    }
  }
}
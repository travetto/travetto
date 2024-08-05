import { Runtime } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliValidationError, ParsedState } from '@travetto/cli';
import { Ignore } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand({ hidden: true })
export class MainCommand implements CliCommandShape {

  @Ignore()
  _parsed: ParsedState;

  async validate(fileOrImport: string): Promise<CliValidationError | undefined> {
    const imp = Runtime.resolveImport(fileOrImport);
    if (!imp) {
      return { message: `Unknown file: ${fileOrImport}` };
    }
  }

  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    let res: unknown;
    try {
      const mod: { main(..._: unknown[]): Promise<unknown> } = await import(Runtime.resolveImport(fileOrImport!));
      res = await mod.main(...args, ...this._parsed.unknown);
    } catch (err) {
      res = err;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (res !== undefined) {
      if (process.connected) { process.send?.(res); }
      const payload = typeof res === 'string' ? res : (res instanceof Error ? res.stack : JSON.stringify(res));
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}
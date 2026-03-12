import { JSONUtil, Runtime } from '@travetto/runtime';
import { type CliCommandShape, CliCommand, CliParseUtil } from '@travetto/cli';
import { IsPrivate, MethodValidator, type ValidationError } from '@travetto/schema';

async function validateMain(fileOrImport: string): Promise<ValidationError | undefined> {
  try {
    await Runtime.importFrom(fileOrImport);
  } catch {
    return { message: `Unknown file: ${fileOrImport}`, source: 'arg', kind: 'invalid', path: 'fileOrImport' };
  }
};

/**
 * Allows for running of main entry points
 */
@CliCommand()
@IsPrivate()
export class MainCommand implements CliCommandShape {

  @MethodValidator(validateMain)
  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    const parsed = CliParseUtil.getState(this);
    let result: unknown;
    try {
      const module = await Runtime.importFrom<{ main(..._: unknown[]): Promise<unknown> }>(fileOrImport);
      result = await module.main(...args, ...parsed?.unknown ?? []);
    } catch (error) {
      result = error;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (result !== undefined) {
      if (process.connected) { process.send?.(result); }
      const payload = typeof result === 'string' ? result : (Error.isError(result) ? result.stack : JSONUtil.toUTF8(result));
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}
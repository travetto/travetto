import { CliCommand, type CliCommandShape, CliParseUtil } from '@travetto/cli';
import { JSONUtil, Runtime } from '@travetto/runtime';
import { IsPrivate, MethodValidator, type ValidationError } from '@travetto/schema';

async function validateMain(fileOrImport: string): Promise<ValidationError | undefined> {
  try {
    await Runtime.importFrom(fileOrImport);
  } catch {
    return { message: `Unknown file: ${fileOrImport}`, source: 'arg', kind: 'invalid', path: 'fileOrImport' };
  }
}

/**
 * Execute a module `main()` entrypoint directly.
 *
 * This internal command resolves an import/source target, invokes its exported
 * `main` function, and forwards unknown CLI args to that function.
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
      result = await module.main(...args, ...(parsed?.unknown ?? []));
    } catch (error) {
      result = error;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (result !== undefined) {
      if (process.connected) {
        process.send?.(result);
      }
      const payload = typeof result === 'string' ? result : result instanceof Error ? result.stack : JSONUtil.toUTF8(result);
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}

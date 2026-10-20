import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { PackageUtil } from '@travetto/manifest';
import { Env, ExecUtil, Runtime, WatchUtil } from '@travetto/runtime';
import { MinLength, Validator } from '@travetto/schema';

/**
 * Generate documentation outputs from a module `DOC.tsx` entry file.
 *
 * Supports multiple output formats/targets and optional watch mode for
 * iterative documentation authoring.
 */
@CliCommand()
@Validator(async cmd => {
  const docFile = path.resolve(cmd.input);
  if (!(await fs.stat(docFile, { throwIfNoEntry: false }))) {
    if (cmd.input === 'DOC.tsx') {
      return;
    }
    return { message: `input: ${cmd.input} does not exist`, path: 'input', source: 'flag', kind: 'invalid' };
  }
})
export class DocCommand implements CliCommandShape {
  /** Input File */
  input = 'DOC.tsx';

  /** Outputs */
  @MinLength(1)
  outputs: string[] = PackageUtil.readPackage(Runtime.workspace.path)?.travetto?.doc?.outputs ?? ['README.md'];

  /** Hooks */
  hooks: string[] = PackageUtil.readPackage(Runtime.workspace.path)?.travetto?.doc?.hooks ?? [];

  /** Watch? */
  watch = false;

  finalize(): void {
    Env.DEBUG.set(false);
    Env.TRV_ROLE.set('doc');
    Env.TRV_CLI_IPC.clear();
    Env.TRV_LOG_PLAIN.set(true);
    Env.FORCE_COLOR.set(false); // Prevent restarting
  }

  async runWatch(): Promise<void> {
    const [first, ...args] = process.argv.slice(2).filter(arg => !/(-w|--watch)/.test(arg));
    await WatchUtil.watchCompilerEvents('change', async ({ file }) => {
      if (file === this.input) {
        const subProcess = ExecUtil.spawnPackageCommand('trv', [first, ...args], {
          cwd: Runtime.mainSourcePath,
          env: { ...process.env, ...Env.TRV_QUIET.export(true) },
          stdio: 'inherit'
        });
        await ExecUtil.getResult(subProcess, { catch: true });
      }
    });
  }

  async render(): Promise<void> {
    const { DocRenderer } = await import('../src/render/renderer.ts');
    const ctx = await DocRenderer.get(this.input, Runtime);
    const outputs = this.outputs.map(output =>
      output.includes('.') ? [path.extname(output).replace('.', ''), path.resolve(output)] : ([output, null] as const)
    );

    const rendered: Record<string, string> = {};
    const files: Record<string, string> = {};

    for (const [format, out] of outputs) {
      const result = await ctx.render(format);
      rendered[format] = result;
      if (out) {
        const finalName = path.resolve(out);
        files[format] = finalName;
        await fs.writeFile(finalName, result, 'utf8');
        console.log(`Wrote docs ${this.input}: ${finalName}`);
      } else {
        process.stdout.write(result);
      }
    }

    for (const hookTarget of this.hooks) {
      const { hook } = await Runtime.importFrom<{ hook: (_: typeof rendered) => Promise<void> }>(hookTarget);
      await hook(rendered);
    }
  }

  async main(): Promise<void> {
    this.input = path.resolve(this.input);
    if (!(await fs.stat(this.input, { throwIfNoEntry: false }))) {
      return;
    }

    return this.watch ? this.runWatch() : this.render();
  }
}

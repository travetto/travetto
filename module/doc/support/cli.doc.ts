import fs from 'node:fs/promises';
import path from 'node:path';

import { ExecUtil, Env, Runtime, WatchUtil } from '@travetto/runtime';
import { type CliCommandShape, CliCommand } from '@travetto/cli';
import { MinLength, Validator } from '@travetto/schema';

/**
 * Command line support for generating module docs.
 */
@CliCommand()
@Validator(async (cmd) => {
  const docFile = path.resolve(cmd.input);
  if (!(await fs.stat(docFile).catch(() => false))) {
    return { message: `input: ${cmd.input} does not exist`, path: 'input', source: 'flag', kind: 'invalid' };
  }
})
export class DocCommand implements CliCommandShape {

  /** Input File */
  input = 'DOC.tsx';

  /** Outputs */
  @MinLength(1)
  outputs: string[] = Runtime.workspace.package?.doc?.outputs ?? ['README.md'];

  /** Watch? */
  watch = false;

  finalize(): void {
    Env.DEBUG.set(false);
    Env.TRV_ROLE.set('doc');
    Env.TRV_CLI_IPC.clear();
    Env.TRV_LOG_PLAIN.set(true);
    Env.FORCE_COLOR.set(false);// Prevent restarting
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
      output.includes('.') ? [path.extname(output).replace('.', ''), path.resolve(output)] :
        [output, null] as const
    );

    for (const [format, out] of outputs) {
      const result = await ctx.render(format);
      if (out) {
        const finalName = path.resolve(out);
        await fs.writeFile(finalName, result, 'utf8');
        console.log(`Wrote docs ${this.input}: ${finalName}`);
      } else {
        process.stdout.write(result);
      }
    }
  }

  main(): Promise<void> {
    this.input = path.resolve(this.input);

    return this.watch ? this.runWatch() : this.render();
  }
}
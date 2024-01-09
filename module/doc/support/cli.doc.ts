import fs from 'node:fs/promises';

import { PackageUtil, path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { Env, watchCompiler, Spawn } from '@travetto/base';
import { CliCommandShape, CliCommand, CliValidationError, CliUtil } from '@travetto/cli';
import { MinLength } from '@travetto/schema';

/**
 * Command line support for generating module docs.
 */
@CliCommand()
export class DocCommand implements CliCommandShape {

  /** Input File */
  input = 'DOC.tsx';

  /** Outputs */
  @MinLength(1)
  outputs: string[] = [];

  /** Watch? */
  watch = false;

  preMain(): void {
    Env.DEBUG.set(false);
    Env.TRV_ROLE.set('doc');
    Env.TRV_CLI_IPC.clear();
    Env.TRV_LOG_PLAIN.set(true);
    Env.FORCE_COLOR.set(false);
  }

  preBind(): void {
    const workspacePkg = PackageUtil.readPackage(RuntimeContext.workspace.path);
    this.outputs = workspacePkg.travetto?.doc?.outputs ?? ['README.md'];
  }

  preHelp(): void {
    this.preBind();
  }

  async validate(): Promise<CliValidationError | undefined> {
    const docFile = path.resolve(this.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      return { message: `input: ${this.input} does not exist`, source: 'flag' };
    }
  }

  async runWatch(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    const args = process.argv.slice(2).filter(x => !/(-w|--watch)/.test(x));
    await watchCompiler(async ({ action, file }) => {
      if (action === 'update' && file === this.input) {
        await Spawn.exec('npx', ['trv', ...args], {
          cwd: RuntimeIndex.mainModule.sourcePath,
          env: { ...process.env, ...Env.TRV_QUIET.export(true) },
          stdio: 'inherit'
        }).result;
      }
    }, { restartOnExit: true });
  }

  async render(): Promise<void> {
    const { DocRenderer } = await import('../src/render/renderer.js');
    const ctx = await DocRenderer.get(this.input, RuntimeContext);
    const outputs = this.outputs.map(output =>
      output.includes('.') ? [path.extname(output).replace('.', ''), path.resolve(output)] :
        [output, null] as const
    );

    for (const [fmt, out] of outputs) {
      const result = await ctx.render(fmt);
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
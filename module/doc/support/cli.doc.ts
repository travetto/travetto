import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { PackageUtil } from '@travetto/manifest';
import { ExecUtil, Env, watchCompiler, Runtime } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliValidationError } from '@travetto/cli';
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
    Env.FORCE_COLOR.set(false);// Prevent restarting
  }

  preBind(): void {
    const workspacePkg = PackageUtil.readPackage(Runtime.workspace.path);
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
    const [first, ...args] = process.argv.slice(2).filter(arg => !/(-w|--watch)/.test(arg));
    await watchCompiler({
      onChange: async ({ file }) => {
        if (file === this.input) {
          const subProcess = spawn(process.argv0, [Runtime.trvEntryPoint, first, ...args], {
            cwd: Runtime.mainSourcePath,
            env: { ...process.env, ...Env.TRV_QUIET.export(true) },
            stdio: 'inherit'
          });
          await ExecUtil.getResult(subProcess, { catch: true });
        }
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
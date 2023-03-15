import fs from 'fs/promises';

import { PackageUtil, path, RootIndex, watchFolders } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { CliCommandShape, CliCommand } from '@travetto/cli';

import { DocRenderer } from '../src/render/renderer';
import { MinLength, ValidationError } from '@travetto/schema';

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

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      set: {
        TRV_CONSOLE_WIDTH: 140,
        TRV_CLI_IPC: '',
        FORCE_COLOR: 0,
        TRV_LOG_PLAIN: true
      }
    };
  }

  finalize(): void {
    if (this.outputs.length === 0) {
      const workspacePkg = PackageUtil.readPackage(RootIndex.manifest.workspacePath);
      this.outputs = workspacePkg.travetto?.docOutputs ?? ['README.md'];
    }
    this.input = path.resolve(this.input);
  }

  async validate(...args: unknown[]): Promise<ValidationError | undefined> {
    const docFile = path.resolve(this.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      return {
        kind: 'required',
        path: 'input',
        message: `The input ${this.input} does not exist`
      };
    }
  }

  async runWatch(): Promise<void> {
    const args = process.argv.slice(2).filter(x => !/(-w|--watch)/.test(x));
    const stream = watchFolders([{ src: path.dirname(this.input), immediate: true }]);
    for await (const { action, file } of stream) {
      if (action === 'update' && file === this.input) {
        await ExecUtil.spawn('npx', ['trv', ...args], {
          cwd: RootIndex.mainModule.sourcePath,
          env: { TRV_QUIET: '1' },
          stdio: 'inherit', catchAsResult: true
        });
      }
    }
  }

  async render(): Promise<void> {
    const ctx = await DocRenderer.get(this.input, RootIndex.manifest);
    const outputs = this.outputs.map(output =>
      output.includes('.') ? [path.extname(output).substring(1), path.resolve(output)] :
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
    return this.watch ? this.runWatch() : this.render();
  }
}
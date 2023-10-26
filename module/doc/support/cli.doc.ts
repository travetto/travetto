import fs from 'fs/promises';

import { PackageUtil, path, RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
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

  async validate(...args: unknown[]): Promise<CliValidationError | undefined> {
    const docFile = path.resolve(this.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      return { message: `input: ${this.input} does not exist`, source: 'flag' };
    }
  }

  async runWatch(): Promise<void> {
    if (await CliUtil.runAsRestartable()) {
      return;
    }

    const args = process.argv.slice(2).filter(x => !/(-w|--watch)/.test(x));
    const { listenFileChanges } = await import('@travetto/base/src/internal/compiler-client.js');
    for await (const { action, file } of listenFileChanges()) {
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
    const { DocRenderer } = await import('../src/render/renderer.js');
    const ctx = await DocRenderer.get(this.input, RootIndex.manifest);
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
    return this.watch ? this.runWatch() : this.render();
  }
}
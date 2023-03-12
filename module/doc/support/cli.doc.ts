import fs from 'fs/promises';

import { PackageUtil, path, RootIndex, watchFolders } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { BaseCliCommand, CliCommand } from '@travetto/cli';

import { DocRenderer } from '../src/render/renderer';

/**
 * Command line support for generating module docs.
 */
@CliCommand()
export class DocCommand implements BaseCliCommand {

  /** Input File */
  input = 'DOC.tsx';
  /** Outputs */
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

  async action(): Promise<void | number> {
    const docFile = path.resolve(this.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      console.error(`The input ${this.input} does not exist`);
      return 1;
    }

    if (this.outputs.length === 0) {
      const workspacePkg = PackageUtil.readPackage(RootIndex.manifest.workspacePath);
      this.outputs = workspacePkg.travetto?.docOutputs ?? ['README.md'];
    }

    const outputs = this.outputs.map(output =>
      output.includes('.') ? [path.extname(output).substring(1), path.resolve(output)] :
        [output, null] as const
    );

    if (this.watch) {
      const args = process.argv.slice(2).filter(x => !/(-w|--watch)/.test(x));
      const stream = watchFolders([{ src: path.dirname(docFile), immediate: true }]);
      for await (const { action, file } of stream) {
        if (action === 'update' && file === docFile) {
          await ExecUtil.spawn('npx', ['trv', ...args], {
            cwd: RootIndex.mainModule.sourcePath,
            env: { TRV_QUIET: '1' },
            stdio: 'inherit', catchAsResult: true
          });
        }
      }
    } else {
      try {
        const ctx = await DocRenderer.get(docFile, RootIndex.manifest);

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
      } catch (err) {
        console.error(err);
        return 1;
      }
    }
  }
}
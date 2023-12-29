import os from 'node:os';

import { CliCommandShape, CliFlag, ParsedState, cliTpl } from '@travetto/cli';
import { path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { TimeUtil } from '@travetto/base';
import { Terminal } from '@travetto/terminal';
import { Ignore, Required, Schema } from '@travetto/schema';

import { PackOperation } from './bin/operation';
import { PackUtil } from './bin/util';

export type PackOperationShape<T> = ((config: T) => AsyncIterable<string[]>);

@Schema()
export abstract class BasePackCommand implements CliCommandShape {

  static get entryPoints(): string[] {
    return RuntimeIndex.find({
      module: m => m.prod,
      folder: f => f === 'support',
      file: f => f.sourceFile.includes('entry.')
    })
      .map(x => x.import.replace(/[.][^.]+s$/, ''));
  }

  @Ignore()
  _parsed: ParsedState;

  @CliFlag({ desc: 'Workspace for building', short: 'w' })
  workspace: string = path.resolve(os.tmpdir(), RuntimeIndex.mainModule.sourcePath.replace(/[\/\\: ]/g, '_'));

  @CliFlag({ desc: 'Clean workspace' })
  clean = true;

  @CliFlag({ desc: 'Output location', short: 'o' })
  @Required(false)
  output: string;

  @CliFlag({ desc: 'Create entry scripts', short: 'es' })
  mainScripts: boolean = true;

  @CliFlag({ desc: 'Main name for build artifact', short: 'f' })
  @Required(false)
  mainName: string;

  @CliFlag({ desc: 'Entry point', short: 'e' })
  @Required(false)
  entryPoint: string = '@travetto/cli/support/entry.trv';

  @CliFlag({ desc: 'Minify output' })
  minify = true;

  @CliFlag({ desc: 'Bundle source maps', short: 'sm' })
  sourcemap = false;

  @CliFlag({ desc: 'Include source with source maps', short: 'is' })
  includeSources = false;

  @CliFlag({ desc: 'Eject commands to file', short: 'x' })
  ejectFile?: string;

  @CliFlag({ desc: 'Rollup configuration file', short: 'r' })
  rollupConfiguration = '@travetto/pack/support/bin/rollup';

  @CliFlag({ desc: 'Env Flag File Name' })
  envFile = '.env';

  @CliFlag({ desc: 'Manifest File Name' })
  manifestFile = 'manifest.json';

  @Ignore()
  module: string;

  @Ignore()
  mainFile: string;

  /** Entry arguments */
  @Ignore()
  entryArguments: string[] = [];

  getOperations(): PackOperationShape<this>[] {
    return [
      PackOperation.clean,
      PackOperation.writeEnv,
      PackOperation.writePackageJson,
      PackOperation.writeEntryScript,
      PackOperation.copyResources,
      PackOperation.writeManifest,
      PackOperation.bundle,
    ];
  }

  /**
   * Run all operations
   */
  async * runOperations(): AsyncIterable<string> {
    for (const op of this.getOperations()) {
      for await (const msg of op(this)) {
        yield msg.join(' ');
      }
    }
  }

  async main(args: string[] = []): Promise<void> {
    // Resolve all files to absolute paths
    this.output = this.output ? path.resolve(this.output) : undefined!;
    this.ejectFile = this.ejectFile ? path.resolve(this.ejectFile) : undefined;
    this.workspace = path.resolve(this.workspace);

    // Update entry points
    this.entryArguments = [...this.entryArguments ?? [], ...args, ...this._parsed.unknown];
    this.module ||= RuntimeContext.main.name;
    this.mainName ??= path.basename(this.module);
    this.mainFile = `${this.mainName}.js`;

    const stream = this.runOperations();

    // Eject to file
    if (this.ejectFile) {
      await PackUtil.writeEjectOutput(this.workspace, this.module, stream, this.ejectFile);
    } else {
      const start = Date.now();
      const term = new Terminal();

      await term.streamLines(stream);

      let msg = cliTpl`${{ success: 'Success' }} (${{ identifier: TimeUtil.prettyDeltaSinceTime(start) }}) ${{ subtitle: 'module' }}=${{ param: this.module }}`;
      if (this.output) {
        msg = cliTpl`${msg} ${{ subtitle: 'output' }}=${{ path: this.output }}`;
      }
      await term.writer.writeLine(msg).commit();
    }
  }
}
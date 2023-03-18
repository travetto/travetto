import os from 'os';

import { CliCommandShape, CliFlag, cliTpl } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { TimeUtil } from '@travetto/base';
import { GlobalTerminal } from '@travetto/terminal';
import { Ignore, Required, Schema } from '@travetto/schema';

import { PackOperation } from './bin/operation';
import { PackUtil } from './bin/util';

export type PackOperationShape<T> = ((config: T) => AsyncIterable<string[]>);

@Schema()
export abstract class BasePackCommand implements CliCommandShape {

  static get entryPoints(): string[] {
    return RootIndex.findSupport({ filter: x => x.includes('entry.') })
      .map(x => x.import.replace(/[.][^.]+s$/, ''));
  }

  #unknownArgs?: string[];

  @CliFlag({ desc: 'Workspace for building', short: 'w' })
  workspace: string = path.resolve(os.tmpdir(), RootIndex.mainModule.sourcePath.replace(/[\/\\: ]/g, '_'));

  @CliFlag({ desc: 'Clean workspace' })
  clean = true;

  @CliFlag({ desc: 'Output location', short: 'o' })
  @Required(false)
  output: string;

  @CliFlag({ desc: 'Create entry scripts', short: 'es' })
  mainScripts?: boolean;

  @CliFlag({ desc: 'Main name for build artifact', short: 'f' })
  @Required(false)
  mainName: string;

  @CliFlag({ desc: 'Entry point', short: 'e' })
  @Required(false)
  entryPoint: string = '@travetto/cli/support/entry.cli';

  @CliFlag({ desc: 'Minify output' })
  minify = true;

  @CliFlag({ desc: 'Bundle source maps', short: 'sm' })
  sourcemap = false;

  @CliFlag({ desc: 'Include source with source maps', short: 'is' })
  includeSources = false;

  @CliFlag({ desc: 'Eject commands to file', short: 'x' })
  ejectFile?: string;

  @Ignore()
  module: string;

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

  finalize(unknown: string[]): void {
    this.#unknownArgs = unknown;

    // Resolve all files to absolute paths
    if (this.output) {
      this.output = path.resolve(this.output);
    }
    if (this.ejectFile) {
      this.ejectFile = path.resolve(this.ejectFile);
    }
    this.workspace = path.resolve(this.workspace);
  }

  async main(args: string[] = []): Promise<void> {
    this.entryArguments = [...args, ...this.#unknownArgs ?? []];
    this.module ??= RootIndex.mainModule.name;
    this.mainName ??= path.basename(this.module);

    const stream = this.runOperations();

    // Eject to file
    if (this.ejectFile) {
      await PackUtil.writeEjectOutput(this.workspace, this.module, stream, this.ejectFile);
    } else {
      const start = Date.now();

      await GlobalTerminal.streamLinesWithWaiting(stream, {
        initialDelay: 0,
        cycleDelay: 100,
        end: false,
        position: 'inline',
        committedPrefix: String.fromCharCode(171)
      });
      let msg = cliTpl`${{ success: 'Success' }} (${{ identifier: TimeUtil.prettyDeltaSinceTime(start) }}) ${{ subtitle: 'module' }}=${{ param: this.module }}`;
      if (this.output) {
        msg = cliTpl`${msg} ${{ subtitle: 'output' }}=${{ path: this.output }}`;
      }
      await GlobalTerminal.writeLines(msg);
    }
  }
}
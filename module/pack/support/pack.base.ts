import os from 'os';

import { BaseCliCommand, CliHelp, cliTpl } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { TimeUtil } from '@travetto/base';
import { GlobalTerminal } from '@travetto/terminal';

import { CommonPackConfig } from './bin/types';
import { PackOperation } from './bin/operation';
import { PackUtil } from './bin/util';
import { Alias, Ignore } from '@travetto/schema';

export type PackOperationShape<T extends CommonPackConfig = CommonPackConfig> = ((config: T) => AsyncIterable<string[]>);

const BASIC_OP_SET = [
  PackOperation.clean,
  PackOperation.writeEnv,
  PackOperation.writePackageJson,
  PackOperation.writeEntryScript,
  PackOperation.copyResources,
  PackOperation.primeAppCache,
  PackOperation.writeManifest,
  PackOperation.bundle,
];

export abstract class BasePackCommand implements BaseCliCommand {

  /** Workspace for building */
  @Alias('-w')
  workspace: string = path.resolve(os.tmpdir(), RootIndex.mainModule.sourcePath.replace(/[\/\\: ]/g, '_'));
  /** Clean workspace */
  @Alias('-c')
  clean = true;
  /** Output location */
  @Alias('-o')
  output?: string;
  /** Create entry scripts */
  @Alias('-es')
  mainScripts?: boolean;
  /** Main name for build artifact */
  @Alias('-f')
  mainName?: string;
  /** Entry point  */
  @Alias('-e')
  entryPoint?: string;
  /** Minify output */
  @Alias('-m')
  minify = true;
  /** Bundle source maps */
  @Alias('-sm')
  sourcemap = false;
  /** Include source with source maps */
  @Alias('-is')
  includeSources = false;
  /** Eject commands to file */
  @Alias('-x')
  ejectFile?: string;

  /** Entry arguments */
  @Ignore()
  entryArguments: string[] = [];

  get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath;
  }

  get entryPoints(): string[] {
    return RootIndex.findSupport({ filter: x => x.includes('entry.') })
      .map(x => x.import.replace(/[.][^.]+s$/, ''));
  }

  getArgs(): string | undefined {
    return this.monoRoot ? '<module> [args...]' : '[args...]';
  }

  getSimpleModuleName(): string {
    return RootIndex.mainPackage.name.replace(/[\/]/, '_').replace(/@/, '');
  }

  getOperations(): PackOperationShape[] {
    return BASIC_OP_SET.slice(0);
  }

  /**
   * Run all operations
   */
  async * runOperations(cfg: S): AsyncIterable<string> {
    for (const op of this.getOperations()) {
      for await (const msg of op(cfg)) {
        yield msg.join(' ');
      }
    }
  }


  getModule(moduleName: string): string {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    let module = this.monoRoot ? moduleName : RootIndex.mainModule.name;
    module = RootIndex.getModuleByFolder(module)?.name ?? module;

    // Reinitialize for module
    if (this.monoRoot) {
      RootIndex.reinitForModule(module);
    }

    return module;
  }

  async action(module: string, args: string[]): Promise<void | CliHelp> {
    if (Array.isArray(module)) {
      args = module;
      module = RootIndex.mainModule.name;
    }
    const start = Date.now();
    if (!module && this.monoRoot) {
      return new CliHelp('The module needs to specified when running from a monorepo root');
    }

    module = this.getModule(module);

    this.entryArguments = Array.isArray(args) ? args : [];

    // Resolve all files to absolute paths
    if (this.output) {
      this.output = path.resolve(this.output);
    }
    if (this.ejectFile) {
      this.ejectFile = path.resolve(this.ejectFile);
    }
    this.workspace = path.resolve(this.workspace);

    const stream = this.runOperations(this);

    // Eject to file
    if (this.ejectFile) {
      const output: string[] = [];
      for await (const line of stream) {
        output.push(line);
      }
      await PackUtil.writeEjectOutput(this.workspace, cfg.module, output, this.ejectFile);
    } else {
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
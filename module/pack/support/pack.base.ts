import os from 'node:os';
import path from 'node:path';

import { CliCommandShape, CliFlag, ParsedState, cliTpl } from '@travetto/cli';
import { TimeUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { Terminal } from '@travetto/terminal';
import { Ignore, Required, Schema } from '@travetto/schema';
import { PackageUtil } from '@travetto/manifest';

import { PackOperation } from './bin/operation.ts';
import { PackUtil } from './bin/util.ts';

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

  @CliFlag({ desc: 'Workspace for building', short: 'b' })
  buildDir: string = path.resolve(os.tmpdir(), Runtime.mainSourcePath.replace(/[\/\\: ]/g, '_'));

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
  entryPoint: string = '@travetto/cli/support/entry.trv.ts';

  @CliFlag({ desc: 'Minify output' })
  minify = true;

  @CliFlag({ desc: 'Bundle source maps', short: 'sm' })
  sourcemap = false;

  @CliFlag({ desc: 'Include source with source maps', short: 'is' })
  includeSources = false;

  @CliFlag({ desc: 'Eject commands to file', short: 'x' })
  ejectFile?: string;

  @CliFlag({ desc: 'Rollup configuration file', short: 'r' })
  rollupConfiguration = '@travetto/pack/support/rollup/build.ts';

  @CliFlag({ desc: 'Env Flag File Name' })
  envFile = '.env';

  @CliFlag({ desc: 'Manifest File Name' })
  manifestFile = 'manifest.json';

  @CliFlag({ desc: 'Include workspace resources', short: 'wr' })
  includeWorkspaceResources: boolean = false;

  @CliFlag({ desc: 'External NPM Packages', short: 'np', name: 'npm-package', envVars: ['PACK_EXTERNAL_PACKAGES'] })
  externalDependencies: string[] = [];

  @Ignore()
  module: string;

  @Ignore()
  mainFile: string;

  /** Entry arguments */
  @Ignore()
  entryArguments: string[] = [];

  @Ignore()
  workspaceResourceFolder: string = 'resources-workspace';

  getOperations(): PackOperationShape<this>[] {
    return [
      PackOperation.clean,
      PackOperation.writeEnv,
      PackOperation.writePackageJson,
      PackOperation.writeEntryScript,
      PackOperation.copyMonoRepoResources,
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

  /**
   * Get all binary dependencies
   */
  getBinaryDependencies(): string[] {
    return [...RuntimeIndex.getModuleList('all')]
      .map(m => RuntimeIndex.getModule(m))
      .filter(m => !!m)
      .filter(m => m.prod)
      .map(m => PackageUtil.readPackage(m?.sourcePath))
      .map(p => p?.travetto?.build?.binaryDependencies ?? [])
      .flat();
  }

  async main(args: string[] = []): Promise<void> {
    // Resolve all files to absolute paths
    this.output = this.output ? path.resolve(this.output) : undefined!;
    this.ejectFile = this.ejectFile ? path.resolve(this.ejectFile) : undefined;
    this.buildDir = path.resolve(this.buildDir);

    // Update entry points
    this.entryArguments = [...this.entryArguments ?? [], ...args, ...this._parsed.unknown];
    this.module ||= Runtime.main.name;
    this.mainName ??= path.basename(this.module);
    this.mainFile = `${this.mainName}.js`;

    // Collect binary dependencies
    const binaryDeps = await this.getBinaryDependencies();
    this.externalDependencies = [...this.externalDependencies, ...binaryDeps];

    const stream = this.runOperations();

    // Eject to file
    if (this.ejectFile) {
      await PackUtil.writeEjectOutput(this.buildDir, this.module, stream, this.ejectFile);
    } else {
      const start = Date.now();
      const term = new Terminal();

      await term.streamLines(stream);

      let msg = cliTpl`${{ success: 'Success' }} (${{ identifier: TimeUtil.asClock(Date.now() - start) }}) ${{ subtitle: 'module' }}=${{ param: this.module }}`;
      if (this.output) {
        msg = cliTpl`${msg} ${{ subtitle: 'output' }}=${{ path: this.output }}`;
      }
      await term.writer.writeLine(msg).commit();
    }
  }
}
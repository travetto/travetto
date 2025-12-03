import os from 'node:os';
import path from 'node:path';

import { CliCommandShape, CliFlag, ParsedState, cliTpl } from '@travetto/cli';
import { TimeUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { Terminal } from '@travetto/terminal';
import { Ignore, Method, Required, Schema } from '@travetto/schema';
import { PackageUtil } from '@travetto/manifest';

import { PackOperation } from './bin/operation.ts';
import { PackUtil } from './bin/util.ts';

export type PackOperationShape<T> = ((config: T) => AsyncIterable<string[]>);

@Schema()
export abstract class BasePackCommand implements CliCommandShape {

  static get entryPoints(): string[] {
    return RuntimeIndex.find({
      module: mod => mod.prod,
      folder: folder => folder === 'support',
      file: file => file.sourceFile.includes('entry.')
    })
      .map(file => file.import.replace(/[.][^.]+s$/, ''));
  }

  @Ignore()
  _parsed: ParsedState;

  /** Workspace for building */
  @CliFlag({ short: 'b', full: 'buildDir' })
  buildDirectory: string = path.resolve(os.tmpdir(), Runtime.mainSourcePath.replace(/[\/\\: ]/g, '_'));

  /** Clean workspace */
  clean = true;

  /** Output location */
  @CliFlag({ short: 'o' })
  @Required(false)
  output: string;

  /** Create entry scripts */
  @CliFlag({ short: 'es' })
  mainScripts: boolean = true;

  /** Main name for build artifact */
  @CliFlag({ short: 'f' })
  @Required(false)
  mainName: string;

  /** Entry point */
  @CliFlag({ short: 'e' })
  @Required(false)
  entryPoint: string = '@travetto/cli/support/entry.trv.ts';

  /** Minify output */
  minify = true;

  /** Bundle source maps */
  @CliFlag({ short: 'sm' })
  sourcemap = false;

  /** Include source with source maps */
  @CliFlag({ short: 'is' })
  includeSources = false;

  /** Eject commands to file */
  @CliFlag({ short: 'x' })
  ejectFile?: string;

  /** Rollup configuration file */
  @CliFlag({ short: 'r' })
  rollupConfiguration = '@travetto/pack/support/rollup/build.ts';

  /** Env Flag File Name */
  envFile = '.env';

  /** Manifest File Name */
  manifestFile = 'manifest.json';

  /** Include workspace resources */
  @CliFlag({ short: 'wr' })
  includeWorkspaceResources: boolean = false;

  /** External NPM Packages */
  @CliFlag({ short: 'np', full: 'npm-package', envVars: ['PACK_EXTERNAL_PACKAGES'] })
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
    for (const operation of this.getOperations()) {
      for await (const msg of operation(this)) {
        yield msg.join(' ');
      }
    }
  }

  /**
   * Get all binary dependencies
   */
  getBinaryDependencies(): string[] {
    return [...RuntimeIndex.getModuleList('all')]
      .map(name => RuntimeIndex.getModule(name))
      .filter(mod => !!mod)
      .filter(mod => mod.prod)
      .map(mod => PackageUtil.readPackage(mod?.sourcePath))
      .map(pkg => pkg?.travetto?.build?.binaryDependencies ?? [])
      .flat();
  }

  @Method()
  async main(args: string[] = []): Promise<void> {
    // Resolve all files to absolute paths
    this.output = this.output ? path.resolve(this.output) : undefined!;
    this.ejectFile = this.ejectFile ? path.resolve(this.ejectFile) : undefined;
    this.buildDirectory = path.resolve(this.buildDirectory);

    // Update entry points
    this.entryArguments = [...this.entryArguments ?? [], ...args, ...this._parsed.unknown];
    this.module ||= Runtime.main.name;
    this.mainName ??= path.basename(this.module);
    this.mainFile = `${this.mainName}.js`;

    // Collect binary dependencies
    const dependencies = await this.getBinaryDependencies();
    this.externalDependencies = [...this.externalDependencies, ...dependencies];

    const stream = this.runOperations();

    // Eject to file
    if (this.ejectFile) {
      await PackUtil.writeEjectOutput(this.buildDirectory, this.module, stream, this.ejectFile);
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
import os from 'os';

import { CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';

import { CommonPackConfig, CommonPackOptions } from './bin/types';
import { PackOperation } from './bin/operation';
import { PackUtil } from './bin/util';

export type PackOperationShape<T extends CommonPackConfig> = ((config: T) => AsyncIterable<string[]>);

export abstract class BasePackCommand<T extends CommonPackOptions, S extends CommonPackConfig> extends CliCommand<{}> {

  get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath;
  }

  getArgs(): string | undefined {
    return this.monoRoot ? '<module>' : undefined;
  }

  getCommonOptions(): CommonPackOptions {
    return {
      workspace: this.option({ short: 'w', desc: 'Workspace for building' }),
      clean: this.boolOption({ short: 'c', desc: 'Clean workspace', def: true }),
      output: this.option({ short: 'o', desc: 'Output Location' }),

      entryPoint: this.option({ short: 'e', desc: 'Entry point', def: 'node_modules/@travetto/cli/support/cli.js' }),
      entryCommand: this.option({ short: 'ec', desc: 'Entry command' }),
      entryArguments: this.listOption({ short: 'a', desc: 'Entry arguments' }),
      minify: this.boolOption({ short: 'm', desc: 'Minify output', def: true }),
      sourcemap: this.boolOption({ short: 'sm', desc: 'Bundle source maps' }),
      includeSources: this.boolOption({ short: 'is', desc: 'Include source with source maps' }),
      ejectFile: this.option({ short: 'x', desc: 'Eject commands to file' }),
    };
  }

  abstract getOptions(): T;

  get cmd(): S {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return super.cmd as S;
  }

  getSimpleModuleName(): string {
    return RootIndex.mainPackage.name.replace(/[\/]/, '_').replace(/@/, '');
  }

  getOperations(): PackOperationShape<S>[] {
    const ops: ((config: S) => AsyncIterable<string[]>)[] = [];

    if (this.cmd.clean) {
      ops.push(PackOperation.clean);
    }

    ops.push(
      PackOperation.writeEnv,
      PackOperation.writePackageJson,
      PackOperation.writeEntryScript,
      PackOperation.copyResources,
      PackOperation.primeAppCache,
      PackOperation.writeManifest,
      PackOperation.bundle,
    );

    return ops;
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

  async buildConfig(): Promise<S> {
    this.cmd.workspace ??= path.resolve(os.tmpdir(), RootIndex.mainModule.sourcePath.replace(/[\/\\: ]/g, '_'));
    this.cmd.entryCommand ??= path.basename(this.cmd.entryPoint).replace(/[.][tj]s$/, '');
    this.cmd.module = RootIndex.mainModule.name;
    return this.cmd;
  }

  async action(module: string): Promise<void> {
    if (!module && this.monoRoot) {
      this.showHelp(new Error('The module needs to specified when running from a monorepo root'));
    }

    module = this.getModule(module);

    const cfg = await this.buildConfig();

    for (const k in this.cmd) {
      const v = this.cmd[k];
      if (typeof v === 'string' && /<module>/.test(v)) {
        // @ts-expect-error
        this.cmd[k] = v.replace(/<module>/g, this.getSimpleModuleName());
      }
    }

    // Resolve all files to absolute paths
    if (this.cmd.output) {
      this.cmd.output = path.resolve(this.cmd.output);
    }
    if (this.cmd.ejectFile) {
      this.cmd.ejectFile = path.resolve(this.cmd.ejectFile);
    }
    this.cmd.workspace = path.resolve(this.cmd.workspace);

    // Running
    const output: string[] = [];
    for (const op of this.getOperations()) {
      for await (const msg of op(cfg)) {
        if (this.cmd.ejectFile) {
          output.push(msg.join(' '));
        } else {
          console.log(msg.join(' '));
        }
      }
    }

    // Eject to file
    if (this.cmd.ejectFile) {
      await PackUtil.writeEjectOutput(this.cmd.workspace, cfg.module, output, this.cmd.ejectFile);
    }
  }
}
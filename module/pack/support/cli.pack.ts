import os from 'os';

import { ListOptionConfig, OptionConfig, CliCommand } from '@travetto/cli';
import { PackageUtil, path, RootIndex } from '@travetto/manifest';

import { PackConfig, PackFormat } from './bin/types';
import { PackOperation } from './bin/operation';
import { PackUtil } from './bin/util';

const MODULE_FORMATS = ['module', 'commonjs'] as const;
const OUTPUT_FORMATS = ['bare', 'zip', 'docker'] as const;

type Options = {
  workspace: OptionConfig<string>;
  output: OptionConfig<string>;
  clean: OptionConfig<boolean>;
  ejectFile: OptionConfig<string>;
  format: OptionConfig<PackFormat>;

  // Bundle
  entryPoint: OptionConfig<string>;
  entryCommand: OptionConfig<string>;
  minify: OptionConfig<boolean>;
  sourcemap: OptionConfig<boolean>;
  includeSources: OptionConfig<boolean>;

  // Docker
  dockerImage: OptionConfig<string>;
  dockerName: OptionConfig<string>;
  dockerTag: ListOptionConfig<string>;
  dockerPort: ListOptionConfig<string>;
  dockerPush: OptionConfig<boolean>;
  dockerRegistry: OptionConfig<string>;
};

export class PackCommand extends CliCommand<Options> {

  name = 'pack';

  get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath;
  }

  getArgs(): string {
    return this.monoRoot ? '[module] [format]' : '[format]';
  }

  getOptions(): Options {

    const format =
      PackageUtil.readPackage(RootIndex.mainModule.source).type ??
      PackageUtil.readPackage(RootIndex.manifest.workspacePath).type ?? 'commonjs';

    return {
      workspace: this.option({ short: 'w', desc: 'Workspace for building' }),
      clean: this.boolOption({ short: 'c', desc: 'Clean workspace', def: true }),
      output: this.option({ short: 'o', desc: 'Output Location' }),
      format: this.choiceOption({ short: 'f', desc: 'Output Format', choices: MODULE_FORMATS, def: format }),

      entryPoint: this.option({ short: 'e', desc: 'Entry point', def: 'node_modules/@travetto/cli/support/cli.js' }),
      entryCommand: this.option({ short: 'ec', desc: 'Entry command' }),
      minify: this.boolOption({ short: 'm', desc: 'Minify output' }),
      sourcemap: this.boolOption({ short: 'sm', desc: 'Bundle source maps' }),
      includeSources: this.boolOption({ short: 'is', desc: 'Include source with source maps' }),
      ejectFile: this.option({ short: 'x', desc: 'Eject commands to file' }),

      dockerImage: this.option({ short: 'di', desc: 'Docker Image to extend', def: 'node:18-alpine3.16' }),
      dockerName: this.option({ short: 'dn', desc: 'Docker Image Name' }),
      dockerTag: this.listOption({ short: 'dt', desc: 'Docker Image Tag', def: ['latest'] }),
      dockerPort: this.listOption({ short: 'dp', desc: 'Docker Image Port' }),
      dockerPush: this.boolOption({ short: 'dx', desc: 'Docker Push Tags' }),
      dockerRegistry: this.option({ short: 'dr', desc: 'Docker Registry' })
    };
  }

  async action(...args: string[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const action = (this.monoRoot ? args[1] : args[0]) as (typeof OUTPUT_FORMATS)[number];
    let module = this.monoRoot ? args[0] : RootIndex.mainModule.name;

    module = RootIndex.getModuleByFolder(module)?.name ?? module;

    // Reinitialize for module
    RootIndex.reinitForModule(module);

    this.cmd.workspace ??= path.resolve(os.tmpdir(), RootIndex.mainModule.source.replace(/[\/\\: ]/g, '_'));
    this.cmd.workspace = path.resolve(this.cmd.workspace);

    const simpleName = RootIndex.mainPackage.name.replace(/[\/]/, '_').replace(/@/, '');

    if (!this.cmd.output && action === 'zip') {
      this.cmd.output = `${simpleName}.zip`;
    }
    if (this.cmd.output) {
      this.cmd.output = path.resolve(this.cmd.output);
    }
    if (this.cmd.ejectFile) {
      this.cmd.ejectFile = path.resolve(this.cmd.ejectFile);
    }

    this.cmd.entryCommand ??= path.basename(this.cmd.entryPoint).replace(/[.][tj]s$/, '');

    const ops: ((config: PackConfig) => AsyncIterable<string[]>)[] = [];

    if (this.cmd.clean) {
      ops.push(PackOperation.clean);
    }

    ops.push(
      PackOperation.writeEnv,
      PackOperation.copyResources,
      PackOperation.primeAppCache,
      PackOperation.writeManifest,
      PackOperation.bundle,
    );

    switch (action) {
      case 'zip': ops.push(PackOperation.compress); break;
      case 'docker': ops.push(PackOperation.docker); break;
    }

    const cfg = { ...this.cmd, module };

    // Running
    const output: string[] = [];
    for (const op of ops) {
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
      await PackUtil.writeEjectOutput(this.cmd.workspace, module, output, this.cmd.ejectFile);
    }
  }
}
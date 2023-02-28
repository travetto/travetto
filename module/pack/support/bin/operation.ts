import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';
import { cliTpl } from '@travetto/cli';

import { CommonPackConfig } from './types';
import { PackUtil } from './util';
import { ActiveShellCommand, ShellCommands } from './shell';

async function writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
  await fs.writeFile(file, contents, { encoding: 'utf8', mode });
}

export class PackOperation {

  static async * title(cfg: CommonPackConfig, title: string): AsyncIterable<string[]> {
    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.echo(title);
    } else {
      yield [title];
    }
  }

  /**
   * Clean out pack workspace, removing all content
   */
  static async * clean(cfg: CommonPackConfig): AsyncIterable<string[]> {
    if (!cfg.clean) {
      return;
    }

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Cleaning Output' }} ${{ path: cfg.workspace }}`);

    if (cfg.ejectFile) {
      yield ActiveShellCommand.rmRecursive(cfg.workspace);
      if (cfg.output) {
        yield ActiveShellCommand.rmRecursive(cfg.output);
      }
      yield ActiveShellCommand.mkdir(cfg.workspace);
    } else {
      await fs.rm(cfg.workspace, { recursive: true, force: true });
      if (cfg.output) {
        await fs.rm(cfg.output, { recursive: true, force: true });
      }
      await fs.mkdir(cfg.workspace, { recursive: true });
    }
  }

  /**
   * Invoke bundler (rollup) to produce output in workspace folder
   */
  static async * bundle(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const cwd = RootIndex.outputRoot;

    const bundleCommand = ['npx', 'rollup', '-c', 'node_modules/@travetto/pack/support/bin/rollup.js'];

    const entryPointFile = RootIndex.getFromImport(cfg.entryPoint)!.outputFile.split(`${RootIndex.manifest.outputFolder}/`)[1];

    const env = Object.fromEntries(([
      ['BUNDLE_ENTRY', entryPointFile],
      ['BUNDLE_COMPRESS', cfg.minify],
      ['BUNDLE_SOURCEMAP', cfg.sourcemap],
      ['BUNDLE_SOURCES', cfg.includeSources],
      ['BUNDLE_OUTPUT', cfg.workspace],
      ['BUNDLE_FORMAT', RootIndex.manifest.moduleType],
      ['TRV_MANIFEST', RootIndex.getModule(cfg.module)!.outputPath]
    ] as const)
      .filter(x => x[1] === false || x[1])
      .map(x => [x[0], `${x[1]}`])
    );

    const props = (['minify', 'sourcemap', 'entryPoint'] as const)
      .map(k => cliTpl`${{ subtitle: k }}=${{ param: cfg[k] }}`).join(' ');

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Bundling Output' }} ${props}`);

    if (cfg.ejectFile) {
      yield* Object.entries(env).filter(x => !!x[1]).map(x =>
        ActiveShellCommand.export(x[0], x[1])
      );
      yield ActiveShellCommand.chdir(cwd);
      yield bundleCommand;
      yield ActiveShellCommand.chdir(path.cwd());
    } else {
      await ExecUtil.spawn(bundleCommand[0], bundleCommand.slice(1), { cwd, env, stdio: ['inherit', 'pipe', 'pipe'] }).result;
    }
  }

  /**
   * Write out package.json, to help define how output .js file should be interpreted
   */
  static async * writePackageJson(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const file = 'package.json';
    const pkg = { type: RootIndex.manifest.moduleType };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (cfg.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(cfg.workspace, file),
        [JSON.stringify(pkg)]
      );
    } else {
      await writeRawFile(
        path.resolve(cfg.workspace, file),
        JSON.stringify(pkg, null, 2)
      );
    }
  }

  /**
   * Define .env.js file to control manifest location
   */
  static async * writeEnv(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const file = '.env.js';
    const env = {
      TRV_MANIFEST: `node_modules/${cfg.module}`,
      TRV_CLI_IPC: ''
    };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (cfg.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(cfg.workspace, file),
        PackUtil.buildEnvJS(env)
      );
    } else {
      await writeRawFile(
        path.resolve(cfg.workspace, file),
        PackUtil.buildEnvJS(env).join('\n')
      );
    }
  }

  /**
   * Create launcher scripts (.sh, .cmd) to run output
   */
  static async * writeEntryScript(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const title = 'Writing entry scripts';

    const files = ([['posix', 'sh'], ['win32', 'cmd']] as const)
      .map(([type, ext]) => ({
        fileTitle: cliTpl`${{ title }} ${{ path: `${cfg.entryCommand}.${ext}` }} args=(${{ param: cfg.entryArguments.join(' ') }})`,
        file: `${cfg.entryCommand}.${ext}`,
        text: [
          ShellCommands[type].scriptOpen(),
          ShellCommands[type].chdirScript(),
          ShellCommands[type].callCommandWithAllArgs('node', cfg.entrySource, ...cfg.entryArguments),
        ].map(x => x.join(' '))
      }));

    if (cfg.ejectFile) {
      for (const { fileTitle, text, file } of files) {
        yield* PackOperation.title(cfg, fileTitle);
        yield* ActiveShellCommand.createFile(path.resolve(cfg.workspace, file), text, '755');
      }
    } else {
      for (const { fileTitle, text, file } of files) {
        yield* PackOperation.title(cfg, fileTitle);
        await writeRawFile(path.resolve(cfg.workspace, file), text.join('\n'), '755');
      }
    }
  }

  /**
   * Copy over /resources folder into workspace, will get packaged into final output
   */
  static async * copyResources(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const resources = {
      count: RootIndex.mainModule.files.resources?.length ?? 0,
      src: path.resolve(RootIndex.mainModule.sourcePath, 'resources'),
      dest: path.resolve(cfg.workspace, 'resources')
    };

    const copyFiles = [
      RootIndex.manifest.modules[RootIndex.mainModule.name],
      RootIndex.manifest.modules['@travetto/manifest']
    ].map(mod => ({
      src: path.resolve(RootIndex.outputRoot, mod.outputFolder, 'package.json'),
      dest: path.resolve(cfg.workspace, mod.outputFolder, 'package.json'),
      destFolder: path.resolve(cfg.workspace, mod.outputFolder)
    }));

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Copying over resources' }}`);

    if (cfg.ejectFile) {
      yield* copyFiles.flatMap(mod => [
        ActiveShellCommand.mkdir(path.dirname(mod.dest)),
        ActiveShellCommand.copy(mod.src, mod.dest)
      ]);
      if (resources.count) {
        yield ActiveShellCommand.copyRecursive(resources.src, path.resolve(cfg.workspace, 'resources'));
      }
    } else {
      for (const { src, dest, destFolder } of copyFiles) {
        await fs.mkdir(destFolder, { recursive: true });
        await fs.copyFile(src, dest);
      }

      if (resources.count) {
        await fs.mkdir(path.dirname(resources.dest), { recursive: true });
        await PackUtil.copyRecursive(resources.src, resources.dest);
      }
    }
  }

  /**
   * Generate the trv-app-cache.json for @travetto/app, which is needed for 'running' programs
   */
  static async * primeAppCache(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const isRun = /entry[.]cli/.test(cfg.entryPoint) && cfg.entryArguments.filter(x => !x.startsWith('-'))[0] === 'run';
    if (!isRun) {
      return;
    }

    const appCacheCmd = ['npx', 'trv', 'main', '@travetto/app/support/bin/list'];
    const sub = path.join(RootIndex.manifest.modules[RootIndex.mainModule.name].outputFolder, 'trv-app-cache.json');
    const env = { DEBUG: '0', TRV_MODULE: cfg.module };
    const appCache = path.resolve(cfg.workspace, sub);

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Generating App Cache' }} ${{ path: sub }}`);

    if (cfg.ejectFile) {
      yield ActiveShellCommand.mkdir(path.dirname(appCache));
      yield [...Object.entries(env).map(x => `${x[0]}=${x[1]}`), ...appCacheCmd, '>', appCache];
    } else {
      const { stdout } = await ExecUtil.spawn(appCacheCmd[0], appCacheCmd.slice(1), { env }).result;

      await fs.mkdir(path.dirname(appCache), { recursive: true });
      await fs.writeFile(appCache, stdout, 'utf8');
    }
  }

  /**
   * Produce the output manifest, only including prod dependencies
   */
  static async * writeManifest(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const out = path.resolve(cfg.workspace, 'node_modules', cfg.module);
    const cmd = ['npx', 'trv', 'manifest', out, 'prod'];
    const env = { TRV_MODULE: cfg.module };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing Manifest' }} ${{ path: path.join('node_modules', cfg.module) }}`);

    if (cfg.ejectFile) {
      yield [...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...cmd];
    } else {
      await ExecUtil.spawn(cmd[0], cmd.slice(1), { env, stdio: ['inherit', 'ignore', 'inherit'] }).result;
    }
  }

  /**
   * Generate ZIP file for workspace
   */
  static async * compress(cfg: CommonPackConfig): AsyncIterable<string[]> {

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Compressing' }} ${{ path: cfg.output }}`);

    if (cfg.ejectFile) {
      yield ActiveShellCommand.chdir(cfg.workspace);
      yield ActiveShellCommand.zip(cfg.output);
      yield ActiveShellCommand.chdir(path.cwd());
    } else {
      const [cmd, ...args] = ActiveShellCommand.zip(cfg.output);
      await ExecUtil.spawn(cmd, args, { cwd: cfg.workspace }).result;
    }
  }
}
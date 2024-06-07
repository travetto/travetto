import fs from 'node:fs/promises';

import { path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';
import { Env } from '@travetto/base';

import { CommonPackConfig } from '../../src/types';
import { PackUtil } from './util';
import { ActiveShellCommand, ShellCommands } from './shell';

/**
 * General pack operations
 */
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
    const cwd = RuntimeIndex.outputRoot;
    const out = RuntimeIndex.manifest.build.outputFolder;

    const bundleCommand = ['npx', 'rollup', '-c', RuntimeIndex.resolveFileImport(cfg.rollupConfiguration)];

    const entryPointFile = RuntimeIndex.getFromImport(cfg.entryPoint)!.outputFile.split(`${out}/`)[1];

    const env = {
      ...Object.fromEntries(([
        ['BUNDLE_ENTRY', entryPointFile],
        ['BUNDLE_MAIN_FILE', cfg.mainFile],
        ['BUNDLE_COMPRESS', cfg.minify],
        ['BUNDLE_SOURCEMAP', cfg.sourcemap],
        ['BUNDLE_SOURCES', cfg.includeSources],
        ['BUNDLE_OUTPUT', cfg.workspace],
        ['BUNDLE_FORMAT', RuntimeContext.workspace.type],
        ['BUNDLE_ENV_FILE', cfg.envFile]
      ] as const)
        .filter(x => x[1] === false || x[1])
        .map(x => [x[0], `${x[1]}`])
      ),
      ...Env.TRV_MANIFEST.export(RuntimeIndex.getModule(cfg.module)!.outputPath),
    };

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
      await PackUtil.runCommand(bundleCommand, { cwd, env: { ...process.env, ...env } });
      const stat = await fs.stat(path.resolve(cfg.workspace, cfg.mainFile));
      yield [cliTpl`${{ title: 'Bundled Output ' }} ${{ identifier: 'sizeKb' }}=${{ param: Math.trunc(stat.size / 2 ** 10) }}`];
    }
  }

  /**
   * Write out package.json, to help define how output .js file should be interpreted
   */
  static async * writePackageJson(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const file = 'package.json';
    const pkg = { type: RuntimeContext.workspace.type, main: cfg.mainFile };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (cfg.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(cfg.workspace, file),
        [JSON.stringify(pkg)]
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(cfg.workspace, file),
        [JSON.stringify(pkg, null, 2)]
      );
    }
  }

  /**
   * Define .env.js file to control manifest location
   */
  static async * writeEnv(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const file = path.resolve(cfg.workspace, cfg.envFile);
    const env = {
      ...Env.NODE_ENV.export('production'),
      ...Env.TRV_MANIFEST.export(cfg.manifestFile),
      ...Env.TRV_MODULE.export(cfg.module),
      ...Env.TRV_CLI_IPC.export(undefined)
    };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (cfg.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(cfg.workspace, file),
        PackUtil.buildEnvFile(env)
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(cfg.workspace, file),
        PackUtil.buildEnvFile(env)
      );
    }
  }

  /**
   * Create launcher scripts (.sh, .cmd) to run output
   */
  static async * writeEntryScript(cfg: CommonPackConfig): AsyncIterable<string[]> {
    if (!cfg.mainScripts && !cfg.entryPoint.includes('@travetto/cli')) {
      return;
    }

    const title = 'Writing entry scripts';

    const files = ([['posix', 'sh'], ['win32', 'cmd']] as const)
      .map(([type, ext]) => ({
        fileTitle: cliTpl`${{ title }} ${{ path: `${cfg.mainName}.${ext}` }} args=(${{ param: cfg.entryArguments.join(' ') }})`,
        file: `${cfg.mainName}.${ext}`,
        text: [
          ShellCommands[type].scriptOpen(),
          ShellCommands[type].chdirScript(),
          ShellCommands[type].callCommandWithAllArgs('node', cfg.mainFile, ...cfg.entryArguments),
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
        await PackUtil.writeRawFile(path.resolve(cfg.workspace, file), text, '755');
      }
    }
  }

  /**
   * Copy over repo /resources folder into workspace, will get packaged into final output
   */
  static async * copyMonoRepoResources(cfg: CommonPackConfig): AsyncIterable<string[]> {
    if (!cfg.includeWorkspaceResources) {
      return;
    }

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Copying over workspace resources' }}`);

    const dest = path.resolve(cfg.workspace, 'workspace-resources');
    const src = RuntimeContext.workspaceRelative('resources');

    if (cfg.ejectFile) {
      yield ActiveShellCommand.copyRecursive(src, dest, true);
    } else {
      await fs.mkdir(dest, { recursive: true });
      await PackUtil.copyRecursive(src, dest, true);
    }
  }

  /**
   * Copy over /resources folder into workspace, will get packaged into final output
   */
  static async * copyResources(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const resources = {
      count: RuntimeIndex.mainModule.files.resources?.length ?? 0,
      src: path.resolve(RuntimeIndex.mainModule.sourcePath, 'resources'),
      dest: path.resolve(cfg.workspace, 'resources')
    };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Copying over module resources' }}`);

    if (cfg.ejectFile) {
      if (resources.count) {
        yield ActiveShellCommand.copyRecursive(resources.src, path.resolve(cfg.workspace, 'resources'));
      }
    } else {
      if (resources.count) {
        await fs.mkdir(path.dirname(resources.dest), { recursive: true });
        await PackUtil.copyRecursive(resources.src, resources.dest);
      }
    }
  }

  /**
   * Produce the output manifest, only including prod dependencies
   */
  static async * writeManifest(cfg: CommonPackConfig): AsyncIterable<string[]> {
    const out = path.resolve(cfg.workspace, cfg.manifestFile);
    const cmd = ['npx', 'trvc', 'manifest', '--prod', out];
    const env = { ...Env.TRV_MODULE.export(cfg.module) };

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Writing Manifest' }} ${{ path: cfg.manifestFile }}`);

    if (cfg.ejectFile) {
      yield [...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...cmd];
    } else {
      await PackUtil.runCommand(cmd, { env: { ...process.env, ...env } });
    }
  }

  /**
   * Generate ZIP file for workspace
   */
  static async * compress(cfg: CommonPackConfig): AsyncIterable<string[]> {

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Compressing' }} ${{ path: cfg.output }}`);

    if (cfg.ejectFile) {
      yield ActiveShellCommand.chdir(cfg.workspace);
      await ActiveShellCommand.mkdir(path.dirname(cfg.output));
      yield ActiveShellCommand.zip(cfg.output);
      yield ActiveShellCommand.chdir(path.cwd());
    } else {
      await fs.mkdir(path.dirname(cfg.output), { recursive: true });
      await PackUtil.runCommand(ActiveShellCommand.zip(cfg.output), { cwd: cfg.workspace });
    }
  }
}
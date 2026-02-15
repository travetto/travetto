import fs from 'node:fs/promises';
import path from 'node:path';

import { cliTpl } from '@travetto/cli';
import { JSONUtil, Env, Runtime, RuntimeIndex } from '@travetto/runtime';

import type { CommonPackConfig } from '../../src/types.ts';
import { PackUtil } from './util.ts';
import { ActiveShellCommand, ShellCommands } from './shell.ts';

/**
 * General pack operations
 */
export class PackOperation {

  static async * title(config: CommonPackConfig, title: string): AsyncIterable<string[]> {
    if (config.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.echo(title);
    } else {
      yield [title];
    }
  }

  /**
   * Clean out pack workspace, removing all content
   */
  static async * clean(config: CommonPackConfig): AsyncIterable<string[]> {
    if (!config.clean) {
      return;
    }

    yield* PackOperation.title(config, cliTpl`${{ title: 'Cleaning Output' }} ${{ path: config.buildDirectory }}`);

    if (config.ejectFile) {
      yield ActiveShellCommand.rmRecursive(config.buildDirectory);
      if (config.output) {
        yield ActiveShellCommand.rmRecursive(config.output);
      }
      yield ActiveShellCommand.mkdir(config.buildDirectory);
    } else {
      await fs.rm(config.buildDirectory, { recursive: true, force: true });
      if (config.output) {
        await fs.rm(config.output, { recursive: true, force: true });
      }
      await fs.mkdir(config.buildDirectory, { recursive: true });
    }
  }

  /**
   * Invoke bundler (rollup) to produce output in workspace folder
   */
  static async * bundle(config: CommonPackConfig): AsyncIterable<string[]> {
    const cwd = RuntimeIndex.outputRoot;
    const out = RuntimeIndex.manifest.build.outputFolder;

    const bundleCommand = [process.argv0, RuntimeIndex.resolvePackageCommand('rollup'), '-c', RuntimeIndex.resolveFileImport(config.rollupConfiguration)];

    const entryPointFile = RuntimeIndex.getFromImport(config.entryPoint)!.outputFile.split(`${out}/`)[1];

    const env = {
      ...Object.fromEntries(([
        ['BUNDLE_ENTRY', entryPointFile],
        ['BUNDLE_MAIN_FILE', config.mainFile],
        ['BUNDLE_COMPRESS', config.minify],
        ['BUNDLE_SOURCEMAP', config.sourcemap],
        ['BUNDLE_SOURCES', config.includeSources],
        ['BUNDLE_OUTPUT', config.buildDirectory],
        ['BUNDLE_ENV_FILE', config.envFile],
        ['BUNDLE_EXTERNAL', config.externalDependencies.map(module => module.split(':')[0]).join(',')]
      ] as const)
        .filter(pair => pair[1] === false || pair[1])
        .map(pair => [pair[0], `${pair[1]}`])
      ),
      ...Env.TRV_MANIFEST.export(RuntimeIndex.getModule(config.module)!.outputPath),
    };

    const properties = (['minify', 'sourcemap', 'entryPoint'] as const)
      .map(key => cliTpl`${{ subtitle: key }}=${{ param: config[key] }}`).join(' ');

    yield* PackOperation.title(config, cliTpl`${{ title: 'Bundling Output' }} ${properties}`);

    if (config.ejectFile) {
      yield* Object
        .entries(env)
        .filter(pair => !!pair[1])
        .map(pair => ActiveShellCommand.export(pair[0], pair[1]));
      yield ActiveShellCommand.chdir(cwd);
      yield bundleCommand;
      yield ActiveShellCommand.chdir(path.resolve());
    } else {
      await PackUtil.runCommand(bundleCommand, { cwd, env: { ...process.env, ...env }, stdio: [0, 'pipe', 2] });
      const stat = await fs.stat(path.resolve(config.buildDirectory, config.mainFile));
      yield [cliTpl`${{ title: 'Bundled Output ' }} ${{ identifier: 'sizeKb' }}=${{ param: Math.trunc(stat.size / 2 ** 10) }}`];
    }
  }

  /**
   * Write out package.json, to help define how output .js file should be interpreted
   */
  static async * writePackageJson(config: CommonPackConfig): AsyncIterable<string[]> {
    const file = 'package.json';
    const pkg = { type: 'module', main: config.mainFile };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (config.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(config.buildDirectory, file),
        [JSONUtil.toUTF8(pkg)]
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(config.buildDirectory, file),
        [JSONUtil.toUTF8Pretty(pkg)]
      );
    }
  }

  /**
   * Define .env.js file to control manifest location
   */
  static async * writeEnv(config: CommonPackConfig): AsyncIterable<string[]> {
    const file = path.resolve(config.buildDirectory, config.envFile);
    const env = {
      ...Env.NODE_ENV.export('production'),
      ...Env.TRV_MANIFEST.export(config.manifestFile),
      ...Env.TRV_MODULE.export(config.module),
      ...Env.TRV_CLI_IPC.export(undefined),
      ...Env.TRV_RESOURCE_OVERRIDES.export({
        '@#resources': '@@#resources',
        ...(config.includeWorkspaceResources ? {
          '@@#resources': `@@#${config.workspaceResourceFolder}`
        } : {})
      })
    };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (config.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(config.buildDirectory, file),
        PackUtil.buildEnvFile(env)
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(config.buildDirectory, file),
        PackUtil.buildEnvFile(env)
      );
    }
  }

  /**
   * Create launcher scripts (.sh, .cmd) to run output
   */
  static async * writeEntryScript(config: CommonPackConfig): AsyncIterable<string[]> {
    if (!config.mainScripts && !config.entryPoint.includes('@travetto/cli')) {
      return;
    }

    const title = 'Writing entry scripts';
    for (const sh of [ShellCommands.posix, ShellCommands.win32]) {
      const { ext, contents } = sh.script(
        sh.callCommandWithAllArgs('node', config.mainFile, ...config.entryArguments), true
      );
      const file = `${config.mainName}${ext}`;
      const args = config.entryArguments.join(' ');

      yield* PackOperation.title(config, cliTpl`${{ title }} ${{ path: file }} args=(${{ param: args }})`);

      if (config.ejectFile) {
        yield* ActiveShellCommand.createFile(path.resolve(config.buildDirectory, file), contents, '755');

      } else {
        await PackUtil.writeRawFile(path.resolve(config.buildDirectory, file), contents, '755');
      }
    }
  }

  /**
   * Copy over repo /resources folder into workspace, will get packaged into final output
   */
  static async * copyMonoRepoResources(config: CommonPackConfig): AsyncIterable<string[]> {
    if (!config.includeWorkspaceResources) {
      return;
    }

    yield* PackOperation.title(config, cliTpl`${{ title: 'Copying over workspace resources' }}`);

    const destinationDirectory = path.resolve(config.buildDirectory, config.workspaceResourceFolder);
    const sourceDirectory = Runtime.workspaceRelative('resources');

    if (config.ejectFile) {
      yield ActiveShellCommand.copyRecursive(sourceDirectory, destinationDirectory, true);
    } else {
      await PackUtil.copyRecursive(sourceDirectory, destinationDirectory, true);
    }
  }

  /**
   * Copy over /resources folder into workspace, will get packaged into final output
   */
  static async * copyResources(config: CommonPackConfig): AsyncIterable<string[]> {
    const resources = {
      count: RuntimeIndex.mainModule.files.resources?.length ?? 0,
      sourceDirectory: path.resolve(Runtime.mainSourcePath, 'resources'),
      destinationDirectory: path.resolve(config.buildDirectory, 'resources')
    };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Copying over module resources' }}`);

    if (config.ejectFile) {
      if (resources.count) {
        yield ActiveShellCommand.copyRecursive(resources.sourceDirectory, path.resolve(config.buildDirectory, 'resources'), true);
      }
    } else {
      if (resources.count) {
        await PackUtil.copyRecursive(resources.sourceDirectory, resources.destinationDirectory, true);
      }
    }
  }

  /**
   * Produce the output manifest, only including production dependencies
   */
  static async * writeManifest(config: CommonPackConfig): AsyncIterable<string[]> {
    const out = path.resolve(config.buildDirectory, config.manifestFile);
    const cmd = [process.argv0, RuntimeIndex.resolvePackageCommand('trvc'), 'manifest:production', out];
    const env = { ...Env.TRV_MODULE.export(config.module) };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Writing Manifest' }} ${{ path: config.manifestFile }}`);

    if (config.ejectFile) {
      yield [...Object.entries(env).map(([key, value]) => `${key}=${value}`), ...cmd];
    } else {
      await PackUtil.runCommand(cmd, { env: { ...process.env, ...env } });
    }
  }

  /**
   * Generate ZIP file for workspace
   */
  static async * compress(config: CommonPackConfig): AsyncIterable<string[]> {

    yield* PackOperation.title(config, cliTpl`${{ title: 'Compressing' }} ${{ path: config.output }}`);

    if (config.ejectFile) {
      yield ActiveShellCommand.mkdir(path.dirname(config.output));
      yield ActiveShellCommand.chdir(config.buildDirectory);
      yield ActiveShellCommand.zip(config.output);
      yield ActiveShellCommand.chdir(path.resolve());
    } else {
      await fs.mkdir(path.dirname(config.output), { recursive: true });
      await PackUtil.runCommand(ActiveShellCommand.zip(config.output), { cwd: config.buildDirectory });
    }
  }
}
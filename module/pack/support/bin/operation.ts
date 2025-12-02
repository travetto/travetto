import fs from 'node:fs/promises';
import path from 'node:path';

import { cliTpl } from '@travetto/cli';
import { Env, Runtime, RuntimeIndex } from '@travetto/runtime';

import { CommonPackConfig } from '../../src/types.ts';
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

    yield* PackOperation.title(config, cliTpl`${{ title: 'Cleaning Output' }} ${{ path: config.buildDir }}`);

    if (config.ejectFile) {
      yield ActiveShellCommand.rmRecursive(config.buildDir);
      if (config.output) {
        yield ActiveShellCommand.rmRecursive(config.output);
      }
      yield ActiveShellCommand.mkdir(config.buildDir);
    } else {
      await fs.rm(config.buildDir, { recursive: true, force: true });
      if (config.output) {
        await fs.rm(config.output, { recursive: true, force: true });
      }
      await fs.mkdir(config.buildDir, { recursive: true });
    }
  }

  /**
   * Invoke bundler (rollup) to produce output in workspace folder
   */
  static async * bundle(config: CommonPackConfig): AsyncIterable<string[]> {
    const cwd = RuntimeIndex.outputRoot;
    const out = RuntimeIndex.manifest.build.outputFolder;

    const bundleCommand = ['npx', 'rollup', '-c', RuntimeIndex.resolveFileImport(config.rollupConfiguration)];

    const entryPointFile = RuntimeIndex.getFromImport(config.entryPoint)!.outputFile.split(`${out}/`)[1];

    const env = {
      ...Object.fromEntries(([
        ['BUNDLE_ENTRY', entryPointFile],
        ['BUNDLE_MAIN_FILE', config.mainFile],
        ['BUNDLE_COMPRESS', config.minify],
        ['BUNDLE_SOURCEMAP', config.sourcemap],
        ['BUNDLE_SOURCES', config.includeSources],
        ['BUNDLE_OUTPUT', config.buildDir],
        ['BUNDLE_FORMAT', Runtime.workspace.type],
        ['BUNDLE_ENV_FILE', config.envFile],
        ['BUNDLE_EXTERNAL', config.externalDependencies.map(x => x.split(':')[0]).join(',')]
      ] as const)
        .filter(x => x[1] === false || x[1])
        .map(x => [x[0], `${x[1]}`])
      ),
      ...Env.TRV_MANIFEST.export(RuntimeIndex.getModule(config.module)!.outputPath),
    };

    const properties = (['minify', 'sourcemap', 'entryPoint'] as const)
      .map(key => cliTpl`${{ subtitle: key }}=${{ param: config[key] }}`).join(' ');

    yield* PackOperation.title(config, cliTpl`${{ title: 'Bundling Output' }} ${properties}`);

    if (config.ejectFile) {
      yield* Object.entries(env).filter(x => !!x[1]).map(x =>
        ActiveShellCommand.export(x[0], x[1])
      );
      yield ActiveShellCommand.chdir(cwd);
      yield bundleCommand;
      yield ActiveShellCommand.chdir(path.resolve());
    } else {
      await PackUtil.runCommand(bundleCommand, { cwd, env: { ...process.env, ...env }, stdio: [0, 'pipe', 2] });
      const stat = await fs.stat(path.resolve(config.buildDir, config.mainFile));
      yield [cliTpl`${{ title: 'Bundled Output ' }} ${{ identifier: 'sizeKb' }}=${{ param: Math.trunc(stat.size / 2 ** 10) }}`];
    }
  }

  /**
   * Write out package.json, to help define how output .js file should be interpreted
   */
  static async * writePackageJson(config: CommonPackConfig): AsyncIterable<string[]> {
    const file = 'package.json';
    const pkg = { type: Runtime.workspace.type, main: config.mainFile };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Writing' }} ${{ path: file }}`);

    if (config.ejectFile) {
      yield* ActiveShellCommand.createFile(
        path.resolve(config.buildDir, file),
        [JSON.stringify(pkg)]
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(config.buildDir, file),
        [JSON.stringify(pkg, null, 2)]
      );
    }
  }

  /**
   * Define .env.js file to control manifest location
   */
  static async * writeEnv(config: CommonPackConfig): AsyncIterable<string[]> {
    const file = path.resolve(config.buildDir, config.envFile);
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
        path.resolve(config.buildDir, file),
        PackUtil.buildEnvFile(env)
      );
    } else {
      await PackUtil.writeRawFile(
        path.resolve(config.buildDir, file),
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
        yield* ActiveShellCommand.createFile(path.resolve(config.buildDir, file), contents, '755');

      } else {
        await PackUtil.writeRawFile(path.resolve(config.buildDir, file), contents, '755');
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

    const dest = path.resolve(config.buildDir, config.workspaceResourceFolder);
    const src = Runtime.workspaceRelative('resources');

    if (config.ejectFile) {
      yield ActiveShellCommand.copyRecursive(src, dest, true);
    } else {
      await PackUtil.copyRecursive(src, dest, true);
    }
  }

  /**
   * Copy over /resources folder into workspace, will get packaged into final output
   */
  static async * copyResources(config: CommonPackConfig): AsyncIterable<string[]> {
    const resources = {
      count: RuntimeIndex.mainModule.files.resources?.length ?? 0,
      src: path.resolve(Runtime.mainSourcePath, 'resources'),
      dest: path.resolve(config.buildDir, 'resources')
    };

    yield* PackOperation.title(config, cliTpl`${{ title: 'Copying over module resources' }}`);

    if (config.ejectFile) {
      if (resources.count) {
        yield ActiveShellCommand.copyRecursive(resources.src, path.resolve(config.buildDir, 'resources'), true);
      }
    } else {
      if (resources.count) {
        await PackUtil.copyRecursive(resources.src, resources.dest, true);
      }
    }
  }

  /**
   * Produce the output manifest, only including prod dependencies
   */
  static async * writeManifest(config: CommonPackConfig): AsyncIterable<string[]> {
    const out = path.resolve(config.buildDir, config.manifestFile);
    const cmd = ['npx', 'trvc', 'manifest', '--prod', out];
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
      await ActiveShellCommand.mkdir(path.dirname(config.output));
      yield ActiveShellCommand.chdir(config.buildDir);
      yield ActiveShellCommand.zip(config.output);
      yield ActiveShellCommand.chdir(path.resolve());
    } else {
      await fs.mkdir(path.dirname(config.output), { recursive: true });
      await PackUtil.runCommand(ActiveShellCommand.zip(config.output), { cwd: config.buildDir });
    }
  }
}
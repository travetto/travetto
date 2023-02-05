import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { PackConfig } from './types';
import { PackUtil } from './util';
import { ActiveShellCommand } from './shell';

async function writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
  await fs.writeFile(file, contents, { encoding: 'utf8', mode });
}

export class PackOperation {

  static async * clean(cfg: PackConfig): AsyncIterable<string[]> {
    if (!cfg.clean) {
      return;
    }

    const title = 'Cleaning Output';

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.rmRecursive(cfg.workspace);
      if (cfg.output) {
        yield ActiveShellCommand.rmRecursive(cfg.output);
      }
      yield ActiveShellCommand.mkdir(cfg.workspace);
    } else {
      yield [title];
      await fs.rm(cfg.workspace, { recursive: true, force: true });
      if (cfg.output) {
        await fs.rm(cfg.output, { recursive: true, force: true });
      }
      await fs.mkdir(cfg.workspace, { recursive: true });
    }
  }

  static async * bundle(cfg: PackConfig): AsyncIterable<string[]> {
    const cwd = path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder);

    const bundleCommand = ['npx', 'rollup', '-c', 'node_modules/@travetto/pack/support/bin/rollup.js'];

    const env = Object.fromEntries(([
      ['BUNDLE_ENTRY', cfg.entryPoint],
      ['BUNDLE_ENTRY_NAME', cfg.entryCommand],
      ['BUNDLE_COMPRESS', cfg.minify],
      ['BUNDLE_SOURCEMAP', cfg.sourcemap],
      ['BUNDLE_SOURCES', cfg.includeSources],
      ['BUNDLE_OUTPUT', cfg.workspace],
      ['BUNDLE_FORMAT', cfg.format],
      ['TRV_MANIFEST', cfg.module]
    ] as const)
      .filter(x => x[1] === false || x[1])
      .map(x => [x[0], `${x[1]}`])
    );

    const title = 'Bundling Output';

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield* Object.entries(env).filter(x => !!x[1]).map(x =>
        ActiveShellCommand.export(x[0], x[1])
      );
      yield ActiveShellCommand.chdir(cwd);
      yield bundleCommand;
    } else {
      yield [title];
      await ExecUtil.spawn(bundleCommand[0], bundleCommand.slice(1), { cwd, env, stdio: ['ignore', 'ignore', 'pipe'] }).result;
    }
  }

  static async * writePackageJson(cfg: PackConfig): AsyncIterable<string[]> {
    const title = 'Writing package.json';
    const pkg = { type: cfg.format };

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield* ActiveShellCommand.createScript(
        path.resolve(cfg.workspace, 'package.json'),
        [JSON.stringify(pkg)]
      );
    } else {
      yield [title];
      await writeRawFile(
        path.resolve(cfg.workspace, 'package.json'),
        JSON.stringify(pkg, null, 2)
      );
    }
  }

  static async * writeEnv(cfg: PackConfig): AsyncIterable<string[]> {
    const title = 'Writing .env.js';
    const env = {
      TRV_MANIFEST: cfg.module,
      TRV_CLI_IPC: ''
    };

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield* ActiveShellCommand.createScript(
        path.resolve(cfg.workspace, '.env.js'),
        PackUtil.buildEnvJS(env)
      );
    } else {
      yield [title];
      await writeRawFile(
        path.resolve(cfg.workspace, '.env.js'),
        PackUtil.buildEnvJS(env).join('\n')
      );
    }
  }

  static async * copyResources(cfg: PackConfig): AsyncIterable<string[]> {
    const resources = {
      count: RootIndex.mainModule.files.resources?.length ?? 0,
      src: path.resolve(RootIndex.mainModule.source, 'resources'),
      dest: path.resolve(cfg.workspace, 'resources')
    };

    const copyFiles = [
      RootIndex.manifest.modules[RootIndex.mainModule.name],
      RootIndex.manifest.modules['@travetto/manifest']
    ].map(mod => ({
      src: path.resolve(RootIndex.manifest.outputFolder, mod.output, 'package.json'),
      dest: path.resolve(cfg.workspace, mod.output, 'package.json'),
      destFolder: path.resolve(cfg.workspace, mod.output)
    }));

    const title = 'Copying over resources';

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield* copyFiles.flatMap(mod => [
        ActiveShellCommand.mkdir(path.dirname(mod.dest)),
        ActiveShellCommand.copy(mod.src, mod.dest)
      ]);
      if (resources.count) {
        yield ActiveShellCommand.copyRecursive(resources.src, path.resolve(cfg.workspace, 'resources'));
      }
    } else {
      yield [title];

      for (const { src, dest, destFolder } of copyFiles) {
        await fs.mkdir(destFolder, { recursive: true });
        await fs.copyFile(src, dest);
      }

      if (resources.count) {
        await fs.mkdir(resources.dest, { recursive: true });
        await PackUtil.copyRecursive(resources.src, resources.dest);
      }
    }
  }

  static async * primeAppCache(cfg: PackConfig): AsyncIterable<string[]> {
    const isCli = cfg.entryCommand === 'cli' || cfg.entryCommand === 'trv';
    if (!isCli) {
      return;
    }

    const appCacheCmd = ['npx', 'trv', 'main', '@travetto/app/support/bin/list'];
    const appCache = path.resolve(cfg.workspace, RootIndex.manifest.modules[RootIndex.mainModule.name].output, 'trv-app-cache.json');
    const title = 'Generating App Cache';

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.mkdir(path.dirname(appCache));
      yield ['DEBUG=0', `TRV_MANIFEST=${cfg.module}`, ...appCacheCmd, '>', appCache];
    } else {
      yield [title];
      const out = await ExecUtil.spawn(
        appCacheCmd[0], appCacheCmd.slice(1),
        { env: { DEBUG: '0', TRV_MANIFEST: cfg.module } }
      ).result;

      await fs.mkdir(path.dirname(appCache), { recursive: true });
      await fs.writeFile(appCache, out.stdout, 'utf8');
    }
  }

  static async * writeManifest(cfg: PackConfig): AsyncIterable<string[]> {
    const title = 'Writing Manifest';
    const cmd = ['npx', 'trv', 'manifest'];
    const env = { NODE_ENV: 'prod', TRV_MANIFEST: cfg.module, TRV_OUTPUT_FOLDER: cfg.workspace };

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield [...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...cmd];
    } else {
      yield [title];
      await ExecUtil.spawn(cmd[0], cmd.slice(1), { env }).result;
    }
  }

  static async * compress(cfg: PackConfig): AsyncIterable<string[]> {
    const title = 'Compressing';

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.chdir(cfg.workspace);
      yield ActiveShellCommand.zip(cfg.output);
    } else {
      yield [title];
      const [cmd, ...args] = ActiveShellCommand.zip(cfg.output);
      await ExecUtil.spawn(cmd, args, { cwd: cfg.workspace }).result;
    }
  }

  /**
   * Dockerize workspace with flags
   */
  static async* docker(cfg: PackConfig): AsyncIterable<string[]> {
    // const ws = path.resolve(workspace);

    // yield 'Building Dockerfile';


    // const dockerFileBuilder = ({ image, port, app = 'rest', env }: DockerConfig): string => `
    // FROM ${image}
    // WORKDIR /app
    // COPY . .
    // ${Object.entries(env).map(([k, v]) => `ENV ${k} "${v}"`).join('\n')}
    // ${(port ?? []).map(x => `EXPOSE ${x}`).join('\n')}
    // CMD ["./trv", "run", "${app}"]
    // `;

    // await fs.writeFile(path.resolve(ws, 'Dockerfile'), builder!(cfg), { encoding: 'utf8' });

    // yield 'Pulling Base Image';
    // await ExecUtil.spawn('docker', ['pull', image]).result;

    // yield 'Building Docker Container';
    // const tags = tag.map(x => registry ? `${registry}/${name}:${x}` : `${name}:${x}`);
    // const args = ['build', ...tags.flatMap(x => ['-t', x]), '.'];

    // await ExecUtil.spawn('docker', args, { cwd: ws, stdio: [0, 'pipe', 2] }).result;

    // if (push) {
    //   yield 'Pushing Tags';
    //   await ExecUtil.spawn('docker', ['image', 'push', ...tags]).result;
    // }

    // yield cliTpl`${{ success: 'Successfully' }} containerized project`;
  }
}
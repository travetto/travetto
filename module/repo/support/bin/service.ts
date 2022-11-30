import fs from 'fs/promises';

import { ExecutionOptions, FileResourceProvider } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';
import { ManifestRoot, path } from '@travetto/manifest';

import { Exec } from './exec';

const SERVICE_RE = /support\/service[.]/;

export class ServiceRunner {
  static async buildServiceManifest(): Promise<string> {
    const resources = new FileResourceProvider(
      [ModuleIndex.root]
    );

    const manifest = ModuleIndex.manifest;

    for (const service of await resources.query(file => SERVICE_RE.test(file))) {
      const serviceModule = path.dirname(path.dirname(service));
      const manifest: ManifestRoot = JSON.parse(await fs.readFile(
        path.resolve(
          ModuleIndex.root,
          serviceModule,
          'manifest.json'
        ),
        'utf8'));
      const mfMod = manifest.modules[manifest.mainModule];
      manifest.modules[manifest.mainModule] = {
        ...mfMod,
        main: false,
        local: false,
        files: {
          support: mfMod.files.support!.filter(x => SERVICE_RE.test(x[0]))
        }
      };
    }

    const manifestFile = path.resolve(
      manifest.workspacePath,
      manifest.outputFolder,
      manifest.manifestFile
    );

    await fs.writeFile(manifestFile, JSON.stringify(manifest), 'utf8');
    return manifestFile;
  }

  static async runService(args: string[], opts: ExecutionOptions = {}): Promise<void> {
    const file = await this.buildServiceManifest();

    const res = Exec.forCommand(
      ModuleIndex.manifest.workspacePath,
      'trv',
      ['command:service', ...args],
      {
        stdio: [0, 1, 2],
        ...opts,
        env: { TRV_MANIFEST: file },
      }
    );

    await res.result;
  }
}
import { createRequire } from 'module';

import { path } from './path';
import { ManifestIndex } from './manifest-index';
import { Package, PackageDigest } from './types';
import { PackageUtil } from './package';

class $RootIndex extends ManifestIndex {
  /**
   * Load all source modules
   */
  static resolveManifestJSON(root: string, file?: string): string {
    file = file ?? path.resolve(root, 'manifest.json');

    // IF not a file
    if (!file.endsWith('.json')) {
      try {
        // Try to resolve
        const req = createRequire(path.resolve(root, 'node_modules'));
        file = req.resolve(`${file}/manifest.json`);
      } catch {
        // Fallback to assumed node_modules pattern
        file = `${root}/node_modules/${file}/manifest.json`;
      }
    }
    return file;
  }

  #config: Package | undefined;

  constructor(output: string = process.env.TRV_OUTPUT ?? process.cwd()) {
    super(output, $RootIndex.resolveManifestJSON(output, process.env.TRV_MANIFEST));
  }

  async loadSource(): Promise<void> {
    for (const { output } of this.findSrc()) {
      await import(output);
    }
  }

  get main(): Package {
    if (!this.#config) {
      const { output: mainFolder } = this.getModule(this.manifest.mainModule)!;
      this.#config = {
        ...{
          name: 'untitled',
          description: 'A Travetto application',
          version: '0.0.0',
        },
        ...PackageUtil.readPackage(mainFolder)
      };
    }
    return this.#config;
  }

  mainDigest(): PackageDigest {
    return PackageUtil.digest(this.main);
  }
}

let index: $RootIndex | undefined;

try {
  index = new $RootIndex();
} catch { }

export const RootIndex: $RootIndex = index!;
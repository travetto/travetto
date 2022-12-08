import { createRequire } from 'module';

import { path, ManifestIndex } from '@travetto/manifest';

class BootIndex extends ManifestIndex {
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

  constructor(output: string = process.env.TRV_OUTPUT ?? process.cwd()) {
    super(output, BootIndex.resolveManifestJSON(output, process.env.TRV_MANIFEST));
  }

  async loadSource(): Promise<void> {
    for (const { output } of this.findSrc()) {
      await import(output);
    }
  }
}

export const ModuleIndex = new BootIndex();
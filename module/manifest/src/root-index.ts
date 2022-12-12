import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { path } from './path';
import { IndexedModule, ManifestIndex } from './manifest-index';
import { ClassMetadata, Package, PackageDigest } from './types';
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
  #srcCache = new Map();
  #metadata = new Map<string, ClassMetadata>();

  constructor(output: string = process.env.TRV_OUTPUT ?? process.cwd()) {
    super(output, $RootIndex.resolveManifestJSON(output, process.env.TRV_MANIFEST));
  }

  async loadSource(): Promise<void> {
    for (const { output } of this.findSrc()) {
      await import(output);
    }
  }

  /**
   * Get internal id from file name and optionally, class name
   */
  getId(filename: string, clsName?: string): string {
    filename = path.toPosix(filename);
    const id = this.getEntry(filename)?.id ?? filename;
    return clsName ? `${id}￮${clsName}` : id;
  }

  get mainModule(): IndexedModule {
    return this.getModule(this.mainPackage.name)!;
  }

  get mainPackage(): Package {
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
    return PackageUtil.digest(this.mainPackage);
  }

  /**
  * Get source file from output location
  * @param outputFile
  */
  getSourceFile(file: string): string {
    if (!this.#srcCache.has(file)) {
      if (file.startsWith('file:')) {
        this.#srcCache.set(file, path.toPosix(fileURLToPath(file)));
      } else {
        this.#srcCache.set(file, path.toPosix(file));
      }
    }

    const outputFile = this.#srcCache.get(file)!;
    return this.getEntry(outputFile)?.source ?? outputFile;
  }

  setClassMetadata(clsId: string, metadata: ClassMetadata): void {
    this.#metadata.set(clsId, metadata);
  }

  getClassMetadata(clsId: string | Function): ClassMetadata | undefined {
    const id = clsId === undefined ? '' : typeof clsId === 'string' ? clsId : clsId.Ⲑid;
    return this.#metadata.get(id);
  }
}

let index: $RootIndex | undefined;

try {
  index = new $RootIndex();
} catch { }

export const RootIndex: $RootIndex = index!;
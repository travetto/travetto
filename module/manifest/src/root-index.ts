import { path } from './path';
import { IndexedModule, ManifestIndex } from './manifest-index';
import { FunctionMetadata, Package, PackageDigest } from './types';
import { PackageUtil } from './package';

const METADATA = Symbol.for('@travetto/manifest:metadata');
type Metadated = { [METADATA]: FunctionMetadata };

/**
 * Extended manifest index geared for application execution
 */
class $RootIndex extends ManifestIndex {

  #config: Package | undefined;
  #metadata = new Map<string, FunctionMetadata>();

  /**
   * **WARNING**: This is a destructive operation, and should only be called before loading any code
   * @private
   */
  reinitForModule(module: string): void {
    this.init(`${this.outputRoot}/node_modules/${module}`);
    this.#config = undefined;
  }

  /**
   * Determines if the manifest root is the root for a monorepo
   */
  isMonoRepoRoot(): boolean {
    return !!this.manifest.monoRepo && this.manifest.workspacePath === this.manifest.mainPath;
  }

  /**
   * Asynchronously load all source files from manifest
   */
  async loadSource(): Promise<void> {
    for (const { import: imp } of this.findSrc()) {
      await import(imp);
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

  /**
   * Get main module for manifest
   */
  get mainModule(): IndexedModule {
    return this.getModule(this.mainPackage.name)!;
  }

  /**
   * Get main package for manifest
   */
  get mainPackage(): Package {
    if (!this.#config) {
      const { outputPath } = this.getModule(this.manifest.mainModule)!;
      this.#config = {
        ...{
          name: 'untitled',
          description: 'A Travetto application',
          version: '0.0.0',
        },
        ...PackageUtil.readPackage(outputPath)
      };
    }
    return this.#config;
  }

  mainDigest(): PackageDigest {
    return PackageUtil.digest(this.mainPackage);
  }

  /**
  * Get source file from import location
  * @param outputFile
  */
  getSourceFile(importFile: string): string {
    return this.getFromImport(importFile)?.source ?? importFile;
  }

  /**
   * Initialize the meta data for a function/class
   * @param cls Class
   * @param `file` Filename
   * @param `hash` Hash of class contents
   * @param `methods` Methods and their hashes
   * @param `abstract` Is the class abstract
   */
  registerFunction(cls: Function, fileOrImport: string, hash: number, methods?: Record<string, { hash: number }>, abstract?: boolean, synthetic?: boolean): boolean {
    const source = this.getSourceFile(fileOrImport);
    const id = this.getId(source, cls.name);
    Object.defineProperty(cls, 'Ⲑid', { value: id });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (cls as unknown as Metadated)[METADATA] = { id, source, hash, methods, abstract, synthetic };
    this.#metadata.set(id, { id, source, hash, methods, abstract, synthetic });
    return true;
  }

  /**
   * Retrieve function metadata by function, or function id
   */
  getFunctionMetadataFromClass(cls: Function | undefined): FunctionMetadata | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (cls as unknown as Metadated)?.[METADATA];
  }

  /**
   * Retrieve function metadata by function, or function id
   */
  getFunctionMetadata(clsId: string | Function): FunctionMetadata | undefined {
    const id = clsId === undefined ? '' : typeof clsId === 'string' ? clsId : clsId.Ⲑid;
    return this.#metadata.get(id);
  }
}

let index: $RootIndex | undefined;

try {
  index = new $RootIndex(process.env.TRV_MANIFEST!);
} catch (err) {
  if (process.env.TRV_THROW_ROOT_INDEX_ERR) {
    throw err;
  }
}

export const RootIndex: $RootIndex = index!;
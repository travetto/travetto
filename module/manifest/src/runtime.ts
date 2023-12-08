import { path } from './path';
import { IndexedModule, ManifestIndex } from './manifest-index';
import { FunctionMetadata, ManifestRoot } from './types';

const METADATA = Symbol.for('@travetto/manifest:metadata');
type Metadated = { [METADATA]: FunctionMetadata };

let manifest: ManifestRoot;

/**
 * Extended manifest index geared for application execution
 */
class $RuntimeIndex extends ManifestIndex {

  #metadata = new Map<string, FunctionMetadata>();

  /**
   * **WARNING**: This is a destructive operation, and should only be called before loading any code
   * @private
   */
  reinitForModule(module: string): void {
    this.init(`${this.outputRoot}/node_modules/${module}`);
    Object.assign(manifest, this.manifest);
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
    return this.getModule(this.manifest.mainModule)!;
  }

  /**
  * Get source file from import location
  * @param outputFile
  */
  getSourceFile(importFile: string): string {
    return this.getFromImport(importFile)?.sourceFile ?? importFile;
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

  /**
   * Resolve module path to folder, with support for main module and monorepo support
   */
  resolveModulePath(modulePath: string): string {
    const main = this.manifest.mainModule;
    const workspace = this.manifest.workspacePath;
    const [base, sub] = modulePath
      .replace(/^(@@?)(#|$)/g, (_, v, r) => `${v === '@' ? main : workspace}${r}`)
      .split('#');
    return path.resolve(this.hasModule(base) ? this.getModule(base)!.sourcePath : base, sub ?? '.');
  }
}

let index: $RuntimeIndex | undefined;

try {
  index = new $RuntimeIndex(process.env.TRV_MANIFEST!);
  manifest = index.manifest;
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    throw err;
  }
}

export const RuntimeIndex: $RuntimeIndex = index!;
export const RuntimeManifest: ManifestRoot = manifest!;
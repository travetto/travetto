import { path } from './path';
import { ManifestIndex } from './manifest-index';

import type { FunctionMetadata, FunctionMetadataTag } from './types/common';
import type { IndexedModule, ManifestModule } from './types/manifest';

const METADATA = Symbol.for('@travetto/manifest:metadata');
type Metadated = { [METADATA]: FunctionMetadata };

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
    return this.getModule(this.manifest.main.name)!;
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
   * @param `line` Line number in source
   * @param `methods` Methods and their hashes
   * @param `abstract` Is the class abstract
   * @param `synthetic` Is this code generated at build time
   */
  registerFunction(
    cls: Function, fileOrImport: string, tag: FunctionMetadataTag,
    methods?: Record<string, FunctionMetadataTag>, abstract?: boolean, synthetic?: boolean
  ): boolean {
    const source = this.getSourceFile(fileOrImport);
    const id = this.getId(source, cls.name);
    Object.defineProperty(cls, 'Ⲑid', { value: id });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (cls as unknown as Metadated)[METADATA] = { id, source, ...tag, methods, abstract, synthetic };
    this.#metadata.set(id, { id, source, ...tag, methods, abstract, synthetic });
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
  getFunctionMetadata(clsId?: string | Function): FunctionMetadata | undefined {
    const id = clsId === undefined ? '' : typeof clsId === 'string' ? clsId : clsId.Ⲑid;
    return this.#metadata.get(id);
  }

  /**
   * Resolve module path to folder, with support for main module and monorepo support
   */
  resolveModulePath(modulePath: string): string {
    const main = this.manifest.main.name;
    const workspace = this.manifest.workspace.path;
    const [base, sub] = modulePath
      .replace(/^(@@?)(#|$)/g, (_, v, r) => `${v === '@' ? main : workspace}${r}`)
      .split('#');
    return path.resolve(this.hasModule(base) ? this.getModule(base)!.sourcePath : base, sub ?? '.');
  }

  /**
   * Get manifest module by name
   */
  getManifestModule(mod: string): ManifestModule {
    return this.manifest.modules[mod];
  }

  /**
   * Get manifest modules
   */
  getManifestModules(): ManifestModule[] {
    return Object.values(this.manifest.modules);
  }
}

export const RuntimeIndex = new $RuntimeIndex(process.env.TRV_MANIFEST!);
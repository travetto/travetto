import { ManifestIndex } from './manifest-index';
import type { FunctionMetadata, FunctionMetadataTag } from './types/common';

const METADATA = Symbol.for('@travetto/manifest:metadata');
type Metadated = { [METADATA]: FunctionMetadata };

/**
 * Extended manifest index geared for application execution
 */
class $RuntimeIndex extends ManifestIndex {

  #metadata = new Map<string, FunctionMetadata>();

  /**
   * Initialize the meta data for a function/class
   * @param cls Class
   * @param `file` Filename
   * @param `hash` Hash of class contents
   * @param `line` Line number in source
   * @param `methods` Methods and their hashes
   * @param `abstract` Is the class abstract
   * @param `synthetic` Is this code generated at build time
   * @private
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
}

export const RuntimeIndex = new $RuntimeIndex();
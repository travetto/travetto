import type { FunctionMetadata, FunctionMetadataTag } from './types/common';

const METADATA = Symbol.for('@travetto/manifest:metadata');
type Metadated = { [METADATA]: FunctionMetadata };

/**
 * Metadata index for functions
 */
class $MetadataIndex {

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
  register(
    cls: Function, module: [string, string], tag: FunctionMetadataTag,
    methods?: Record<string, FunctionMetadataTag>, abstract?: boolean, synthetic?: boolean
  ): boolean {
    let id = module.join(':');
    if (cls.name) {
      id = `${id}￮${cls.name}`;
    }
    Object.defineProperty(cls, 'Ⲑid', { value: id });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#metadata.set(id, (cls as unknown as Metadated)[METADATA] = {
      id, import: module.join('/'), ...tag, methods, abstract, synthetic
    });
    return true;
  }

  /**
   * Retrieve function metadata by function, or function id
   */
  getFromClass(cls: Function | undefined): FunctionMetadata | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (cls as unknown as Metadated)?.[METADATA];
  }

  /**
   * Retrieve function metadata by function, or function id
   */
  get(clsId?: string | Function): FunctionMetadata | undefined {
    const id = clsId === undefined ? '' : typeof clsId === 'string' ? clsId : clsId.Ⲑid;
    return this.#metadata.get(id);
  }
}

export const MetadataIndex = new $MetadataIndex();
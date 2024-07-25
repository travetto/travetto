export type FunctionMetadataTag = { hash: number, lines: [number, number] };
export type FunctionMetadata = FunctionMetadataTag & {
  id: string;
  import: string;
  methods?: Record<string, FunctionMetadataTag>;
  synthetic?: boolean;
  abstract?: boolean;
};

const METADATA = Symbol.for('@travetto/manifest:function-metadata');

/**
 * Initialize the meta data for a function/class
 * @param fn Class
 * @param `file` Filename
 * @param `hash` Hash of class contents
 * @param `line` Line number in source
 * @param `methods` Methods and their hashes
 * @param `abstract` Is the class abstract
 * @param `synthetic` Is this code generated at build time
 * @private
 */
export function register(
  fn: Function, module: [string, string], tag: FunctionMetadataTag,
  methods?: Record<string, FunctionMetadataTag>, abstract?: boolean, synthetic?: boolean
): void {
  let id = module.join(':');
  if (fn.name) {
    id = `${id}￮${fn.name}`;
  }
  const value = { id, import: module.join('/'), ...tag, methods, abstract, synthetic };
  Object.defineProperties(fn, { 'Ⲑid': { value: id }, [METADATA]: { value } });
}

/**
 * Read metadata
 */
export function describeFunction(fn: Function): FunctionMetadata;
export function describeFunction(fn?: Function): FunctionMetadata | undefined {
  return (fn as unknown as { [METADATA]: FunctionMetadata })?.[METADATA];
}
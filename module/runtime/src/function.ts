export type FunctionMetadataTag = { hash: number, lines: [number, number] };
export type FunctionMetadata = FunctionMetadataTag & {
  id: string;
  import: string;
  methods?: Record<string, FunctionMetadataTag>;
  synthetic?: boolean;
  class?: boolean;
  abstract?: boolean;
};

const METADATA = Symbol.for('@travetto/runtime:function-metadata');

const pending = new Set<Function>([]);

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
export function registerFunction(
  fn: Function, [pkg, pth]: [string, string], tag: FunctionMetadataTag,
  methods?: Record<string, FunctionMetadataTag>, abstract?: boolean, synthetic?: boolean
): void {
  const metadata = {
    id: fn.name ? `${pkg}:${pth}￮${fn.name}` : `${pkg}:${pth}`,
    import: `${pkg}/${pth}`,
    ...tag, methods, abstract, synthetic, class: abstract !== undefined
  };
  pending.add(fn);
  Object.defineProperties(fn, { Ⲑid: { value: metadata.id }, [METADATA]: { value: metadata } });
}

/**
 * Flush all pending function registers
 */
export function flushPendingFunctions(): Function[] {
  const fns = [...pending];
  pending.clear();
  return fns;
}

/**
 * Read metadata
 */
export function describeFunction(fn: Function): FunctionMetadata;
export function describeFunction(fn?: Function): FunctionMetadata | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (fn as unknown as { [METADATA]: FunctionMetadata })?.[METADATA];
}
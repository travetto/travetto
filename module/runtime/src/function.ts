export type FunctionMetadataTag = { hash: number, lines: [start: number, end: number, bodyStart?: number] };
export type FunctionMetadata = FunctionMetadataTag & {
  id: string;
  import: string;
  module: string;
  modulePath: string;
  methods?: Record<string, FunctionMetadataTag>;
  synthetic?: boolean;
  class?: boolean;
  abstract?: boolean;
};

const MetadataSymbol = Symbol.for('@travetto/runtime:function-metadata');

const pending = new Set<Function>([]);

/** @private */
export function setFunctionMetadata<T extends Function>(fn: T, meta: FunctionMetadata): T {
  const _fn: (Function & { [MetadataSymbol]?: FunctionMetadata }) | undefined = fn;
  Object.defineProperty(_fn, MetadataSymbol, { value: meta });
  return fn;
}

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
  const modulePath = pth.replace(/[.][cm]?[tj]sx?$/, '');

  const metadata: FunctionMetadata = {
    id: (fn.name ? `${pkg}:${modulePath}#${fn.name}` : `${pkg}:${modulePath}`),
    import: `${pkg}/${pth}`,
    module: pkg,
    modulePath,
    ...tag, methods, abstract, synthetic, class: abstract !== undefined
  };
  pending.add(fn);
  setFunctionMetadata(fn, metadata);
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
  const _fn: (Function & { [MetadataSymbol]?: FunctionMetadata }) | undefined = fn;
  return _fn?.[MetadataSymbol];
}

/**
 * Get unique id for function/class
 */
export function getUniqueId(fn: Function): string;
export function getUniqueId(fn?: Function): string | undefined {
  const _fn: (Function & { [MetadataSymbol]?: FunctionMetadata, $id?: string }) | undefined = fn;
  return _fn?.[MetadataSymbol]?.id ?? _fn?.$id;
}
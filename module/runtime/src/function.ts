import { ManifestModuleUtil } from '@travetto/manifest';

export type FunctionMetadataTag = { hash: number, lines: [start: number, end: number, bodyStart?: number] };
export type FunctionMetadata = FunctionMetadataTag & {
  id: string;
  import: string;
  module: string;
  modulePath: string;
  methods?: Record<string | symbol, FunctionMetadataTag>;
  class?: boolean;
  abstract?: boolean;
};

const MetadataSymbol = Symbol();

const pending = new Set<Function>([]);

/**
 * Initialize the meta data for a function/class
 * @param fn Class
 * @param `file` Filename
 * @param `hash` Hash of class contents
 * @param `line` Line number in source
 * @param `methods` Methods and their hashes
 * @param `abstract` Is the class abstract
 * @private
 */
export function registerFunction(
  fn: Function, [pkg, pth]: [string, string], tag: FunctionMetadataTag,
  methods?: Record<string, FunctionMetadataTag>, abstract?: boolean,
): void {
  const modulePath = ManifestModuleUtil.withoutSourceExtension(pth);

  const metadata: FunctionMetadata = {
    id: (fn.name ? `${pkg}:${modulePath}#${fn.name}` : `${pkg}:${modulePath}`),
    import: `${pkg}/${pth}`,
    module: pkg,
    modulePath,
    ...tag,
    methods,
    abstract,
    class: methods !== undefined
  };
  pending.add(fn);
  Object.defineProperties(fn, { Ⲑid: { value: metadata.id }, [MetadataSymbol]: { value: metadata } });
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

const foreignTypeRegistry = new Map<string, Function>();
export function foreignType(id: string): Function {
  if (!foreignTypeRegistry.has(id)) {
    const type = class { static Ⲑid = id; };
    foreignTypeRegistry.set(id, type);
  }
  return foreignTypeRegistry.get(id)!;
}
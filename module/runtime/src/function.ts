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
 * @param input Class or function to register
 * @param [module, relativePath] File location
 * @param `hash` Hash of class contents
 * @param `line` Line number in source
 * @param `methods` Methods and their hashes
 * @param `abstract` Is the class abstract
 * @private
 */
export function registerFunction(
  input: Function, [module, relativePath]: [string, string], tag: FunctionMetadataTag,
  methods?: Record<string, FunctionMetadataTag>, abstract?: boolean,
): void {
  const modulePath = ManifestModuleUtil.withoutSourceExtension(relativePath);

  const metadata: FunctionMetadata = {
    id: (input.name ? `${module}:${modulePath}#${input.name}` : `${module}:${modulePath}`),
    import: `${module}/${relativePath}`,
    module,
    modulePath,
    ...tag,
    methods,
    abstract,
    class: methods !== undefined
  };
  pending.add(input);
  Object.defineProperties(input, { Ⲑid: { value: metadata.id }, [MetadataSymbol]: { value: metadata } });
}

/**
 * Flush all pending function registers
 */
export function flushPendingFunctions(): Function[] {
  const functions = [...pending];
  pending.clear();
  return functions;
}

/**
 * Read metadata
 */
export function describeFunction(input: Function): FunctionMetadata;
export function describeFunction(input?: Function): FunctionMetadata | undefined {
  const resolved: (Function & { [MetadataSymbol]?: FunctionMetadata }) | undefined = input;
  return resolved?.[MetadataSymbol];
}

const foreignTypeRegistry = new Map<string, Function>();
export function foreignType(id: string): Function {
  return foreignTypeRegistry.getOrInsert(id, class { static Ⲑid = id; });
}
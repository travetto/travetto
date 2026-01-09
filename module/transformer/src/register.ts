import { type NodeTransformer, type TransformPhase, type TransformerType, type Transformer, ModuleNameSymbol } from './types/visitor.ts';

const HandlersSymbol = Symbol();

type TransformerWithHandlers = Transformer & { [HandlersSymbol]?: NodeTransformer[] };

function isTransformer(value: unknown): value is Transformer {
  return value !== null && value !== undefined && typeof value === 'function';
}

/**
 * Get all transformers
 * @param inputs Object to search for transformers
 */
export function getAllTransformers(inputs: Record<string, { [HandlersSymbol]?: NodeTransformer[] }>, module: string): NodeTransformer[] {
  return Object.values(inputs)
    .flatMap(value => {
      if (isTransformer(value)) {
        value[ModuleNameSymbol] = module;
      }
      return (value[HandlersSymbol] ?? []);
    })
    .map(handler => ({
      ...handler,
      key: `${module}:${handler.key}`,
      target: handler.target?.map(target => `${module}:${target}`)
    }));
}

// Store handlers in class
export function RegisterHandler(cls: TransformerWithHandlers, fn: Function, phase: TransformPhase, type: TransformerType, target?: string[]): void {
  (cls[HandlersSymbol] ??= []).push({ key: fn.name, [phase]: fn.bind(cls), type, target });
}
import { Registry, CompilerMethodSource, CompilerClassSource, RootRegistry } from '../index';

class Simple extends Registry {
}

export const SimpleRegistry = new Simple();

export const MethodListener = new CompilerMethodSource((RootRegistry as any).parents[0]);

MethodListener.on(e => {
  console.log('Method changed', e);
});
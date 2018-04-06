import { Registry, MethodSource, CompilerClassSource, RootRegistry } from '../index';

class Simple extends Registry {
}

export const SimpleRegistry = new Simple();

export const MethodListener = new MethodSource(RootRegistry);

MethodListener.on(e => {
  console.log('Method changed', e);
});
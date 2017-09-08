import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';

class $RootRegistry extends Registry {
  constructor() {
    super(new CompilerClassSource());
  }
}

export const RootRegistry = new $RootRegistry();
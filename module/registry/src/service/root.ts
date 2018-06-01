import { Registry } from './registry';
import { CompilerClassSource, ChangeEvent } from '../source';
import { Class } from '../model';

class $RootRegistry extends Registry {
  constructor(src = new CompilerClassSource()) {
    super(src);
  }

  // Auto propagate
  async onEvent(e: ChangeEvent<Class>) {
    await super.onEvent(e);
    this.emit(e);
  }

  onReset() {
    for (const parent of this.parents) {
      parent!.reset();
    }
  }
}

export const RootRegistry = new $RootRegistry();
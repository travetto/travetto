import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangeEvent } from './class-source';

class $RootRegistry extends Registry {
  constructor() {
    super(new CompilerClassSource());
  }

  // Auto propagate
  async onEvent(e: ChangeEvent) {
    await super.onEvent(e);
    this.emit(e);
  }

  onReset() {
    for (let parent of this.parents) {
      parent!.reset()
    }
  }
}

export const RootRegistry = new $RootRegistry();
import { Registry } from '../registry';
import { ClassSource } from '../source/class-source';
import { Class, ChangeEvent } from '../types';

class $RootRegistry extends Registry {
  constructor() {
    super(new ClassSource());
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
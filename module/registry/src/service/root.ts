import { Env } from '@travetto/base';

import { Registry } from '../registry';
import { CompilerClassSource } from '../source/class-source';
import { Class, ChangeEvent } from '../types';

class $RootRegistry extends Registry {
  constructor(rootPaths: string[]) {
    super(new CompilerClassSource(rootPaths));
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

export const RootRegistry = new $RootRegistry(Env.appRoots);
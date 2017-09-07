import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangedEvent } from './class-source';

class $RootRegistry extends Registry {

  constructor() {
    super(new CompilerClassSource());
  }

  async init() {
    await this.source!.init();
  }

  onEvent(e: ChangedEvent) {
    return super.onEvent(e);
  }
}

export const RootRegistry = new $RootRegistry();
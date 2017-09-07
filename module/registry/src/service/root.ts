import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangedEvent } from './class-source';

class Root extends Registry {

  async _init() {
    let source = new CompilerClassSource();
    await source.init();
    this.listen(source);
  }

  onEvent(e: ChangedEvent) {
    return super.onEvent(e);
  }
}

export const RootRegistry = new Root();
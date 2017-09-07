import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangedEvent } from './class-source';

class $RootRegistry extends Registry {

  async _init() {
    let source = new CompilerClassSource();
    this.listen(source);
    await source.init();
  }

  onEvent(e: ChangedEvent) {
    console.log(e);
    return super.onEvent(e);
  }
}

export const RootRegistry = new $RootRegistry();
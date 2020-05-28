import { Registry } from '../registry';
import { ClassSource } from '../source/class-source';
import { Class, ChangeEvent } from '../types';

/**
 * The root registry that controls all registries
 */
class $RootRegistry extends Registry {
  constructor() {
    super(new ClassSource());
  }

  /**
   * Send event to all all of the children
   */
  async onEvent(e: ChangeEvent<Class>) {
    await super.onEvent(e); // Process event, and
    this.emit(e); // Send to children
  }

  /**
   * Reset self and parents
   */
  onReset() {
    for (const parent of this.parents) {
      parent!.reset();
    }
  }
}

export const RootRegistry = new $RootRegistry();
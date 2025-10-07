import { Any, Class } from '@travetto/runtime';

import { Registry } from '../registry.ts';
import { ClassSource } from '../source/class-source.ts';
import { ChangeEvent } from '../types.ts';

/**
 * The root registry that controls all registries
 */
class $RootRegistry extends Registry<Any> {
  constructor() {
    super(new ClassSource());
  }

  /**
   * Send event to all all of the children
   */
  override async onEvent(e: ChangeEvent<Class>): Promise<void> {
    await super.onEvent(e); // Process event, and
    this.emit(e); // Send to children
  }

  /**
   * Registers a listener to be notified when a file changes, but no
   * classes are modified
   */
  onNonClassChanges(handler: (file: string) => void): void {
    this.parent(ClassSource)!.onNonClassChanges(handler);
  }
}

export const RootRegistry = new $RootRegistry();
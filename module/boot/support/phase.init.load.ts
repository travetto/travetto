import { ModuleIndex } from '../src/module-index';

/**
 * Responsible for loading all available modules
 */
export const step = {
  key: '@trv:boot/load',
  async action(): Promise<void> {
    for (const { file } of ModuleIndex.findSrc({})) {
      await import(file);
    }
  }
};
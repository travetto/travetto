import { ResourceManager } from '../src/resource';

/**
 * Registers Resource manager initialization
 */
export const step = {
  key: '@trv:resource/init',
  action: (): void => {
    ResourceManager.init();
  }
};
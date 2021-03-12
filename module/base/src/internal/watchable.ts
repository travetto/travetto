import { EnvUtil } from '@travetto/boot';
import { Class } from '../types';

/**
 * Denotes a class is watchable, and can optionally be upgraded
 * if watch mode is on
 */
export function Watchable(key: string) {
  return (target: Class<unknown>) => {
    if (EnvUtil.isWatch()) {
      try {
        require.resolve('@travetto/watch'); // Ensure watch is installed
      } catch {
        return;
      }
      // Load Synchronously
      return require(key).watch(target);
    }
  };
}
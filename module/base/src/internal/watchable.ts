import { EnvUtil } from '@travetto/boot';

/**
 * Denotes a class is watchable, and can optionally be upgraded
 * if watch mode is on
 */
export function Watchable(mod: string): ClassDecorator {
  return (target: any) => {
    if (EnvUtil.isTrue('TRV_WATCH')) {
      try {
        require('@travetto/watch'); // Ensure watch is installed
      } catch {
        return;
      }
      return require(mod).watch(target);
    }
  };
}
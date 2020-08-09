import { EnvUtil } from '@travetto/boot';

/**
 * Denotes a class is watchable, and can optionally be upgraded
 * if watch mode is on
 */
export function Watchable(key: string): ClassDecorator {
  return (target: any) => {
    if (EnvUtil.isWatch()) {
      try {
        require('@travetto/watch'); // Ensure watch is installed
      } catch {
        return;
      }
      const [, mod, sub] = key.match(/@trv:([^/]+)\/(.*)/) ?? [];
      const full = `@travetto/${mod}/support/watch.${sub}`;
      return require(full).watch(target);
    }
  };
}
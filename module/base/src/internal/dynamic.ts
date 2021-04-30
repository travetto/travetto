import { EnvUtil } from '@travetto/boot';
import { Class } from '../types';

/**
 * Denotes a class is dynamic
 */
export function Dynamic(key: string) {
  return (target: Class<unknown>) => {
    if (EnvUtil.isDynamic()) {
      // Load Synchronously
      return require(key).init(target);
    }
  };
}
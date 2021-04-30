import { EnvUtil } from '@travetto/boot';
import { Class } from '../types';

/**
 * Denotes a class is dynamic
 */
export function Dynamic(key: string) {
  return (target: Class<unknown>) => {
    if (EnvUtil.isDynamic()) {
      // Decorate
      const ret = require(key).init(target);
      Object.defineProperty(ret, 'name', { value: target.name });
      return ret;
    }
  };
}
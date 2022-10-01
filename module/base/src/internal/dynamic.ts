import { EnvUtil } from '@travetto/boot';
import { Class } from '../types';

/**
 * Denotes a class is dynamic
 */
export function Dynamic(key: string): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ((target: Class<unknown>) => {
    if (EnvUtil.isDynamic()) {
      // Decorate
      const ret = require(key).setup(target);
      Object.defineProperty(ret, 'name', { value: target.name });
      return ret;
    }
  }) as ClassDecorator;
}
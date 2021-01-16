import { Class } from '@travetto/base';
import { ControllerRegistry } from '../registry/controller';

/**
 * Decorator to register a new rest controller
 * @augments `@trv:di/Injectable`
 * @augments `@trv:rest/Controller`
 */
export function Controller(path = '') {
  return function <T>(target: Class<T>) {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  };
}

import { Class } from '@travetto/registry';
import { ControllerRegistry } from '../registry/registry';
import { ControllerDecorator } from '../registry/types';

/**
 * Decorator to register a new rest controller
 * @augments `@trv:di/Injectable`
 * @augments `@trv:rest/Controller`
 */
export function Controller(path = '') {
  return function (target: Class) {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  } as ControllerDecorator;
}

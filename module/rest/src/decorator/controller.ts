import { Class } from '@travetto/runtime';
import { ControllerRegistry } from '../registry/controller.ts';

/**
 * Decorator to register a new rest controller
 * @augments `@travetto/di:Injectable`
 * @augments `@travetto/rest:Controller`
 */
export function Controller(path = '') {
  return function <T>(target: Class<T>): void {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  };
}

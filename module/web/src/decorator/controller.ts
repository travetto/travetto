import { Class } from '@travetto/runtime';
import { ControllerRegistry } from '../registry/controller.ts';

/**
 * Decorator to register a new web controller
 * @augments `@travetto/di:Injectable`
 * @augments `@travetto/web:Controller`
 */
export function Controller(path: string) {
  return function <T>(target: Class<T>): void {
    ControllerRegistry.registerPending(target, { basePath: path, class: target, });
  };
}

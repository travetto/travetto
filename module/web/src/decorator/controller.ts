import { Class } from '@travetto/runtime';
import { ControllerRegistry } from '../registry/controller.ts';
import { ControllerConfig } from '@travetto/web';

/**
 * Decorator to register a new web controller
 * @augments `@travetto/di:Injectable`
 * @augments `@travetto/web:Controller`
 */
export function Controller(path: string, config?: Partial<ControllerConfig>) {
  return function <T>(target: Class<T>): void {
    ControllerRegistry.registerPending(target, {
      ...config,
      basePath: path,
      class: target,
    });
  };
}

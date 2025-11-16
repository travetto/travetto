import { Class } from '@travetto/runtime';
import { ControllerRegistryIndex } from '../registry/registry-index.ts';

/**
 * Decorator to register a new web controller
 * @augments `@travetto/di:Injectable`
 * @augments `@travetto/web:Controller`
 * @augments `@travetto/schema:Schema`
 */
export function Controller(path: string) {
  return function <T>(target: Class<T>): void {
    ControllerRegistryIndex.getForRegister(target).register({ basePath: path, class: target, });
  };
}

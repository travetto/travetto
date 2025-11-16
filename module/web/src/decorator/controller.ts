import { Class } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';

/**
 * Decorator to register a new web controller
 * @augments `@travetto/schema:Schema`
 */
export function Controller(path: string) {
  return function <T>(target: Class<T>): void {
    ControllerRegistryIndex.getForRegister(target).register({ basePath: path, class: target, });
    DependencyRegistryIndex.getForRegister(target).register();
  };
}

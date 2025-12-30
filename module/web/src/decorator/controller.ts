import { Class } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';

/**
 * Decorator to register a new web controller
 * @augments `@travetto/schema:Schema`
 * @example opt-in
 * @kind decorator
 */
export function Controller(path: string) {
  return function <T>(cls: Class<T>): void {
    ControllerRegistryIndex.getForRegister(cls).register({ basePath: path, class: cls, });
    DependencyRegistryIndex.getForRegister(cls).registerClass();
  };
}

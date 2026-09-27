import { castTo, type Class, type ClassInstance, getClass } from '@travetto/runtime';

import type { Skip as SkipPredicate } from '../model/common.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

/**
 * Marks a test or suite if it should be skipped
 * @param predicate The skip configuration predicate that will run with the suite instance
 * @kind decorator
 */
export function SkipIf<T = unknown>(predicate: SkipPredicate<T>): ClassDecorator & MethodDecorator {
  return castTo((target: ClassInstance | Class, property?: string, descriptor?: PropertyDescriptor) => {
    if (property && descriptor) {
      SuiteRegistryIndex.getForRegister(getClass(target)).registerTest(property, descriptor.value, { skip: castTo(predicate) });
      return descriptor;
    } else {
      SuiteRegistryIndex.getForRegister(castTo<Class>(target)).register({ skip: castTo(predicate) });
    }
  });
}

/**
 * Marks a test or suite if it should be skipped when the predicate resolves to false
 * @param predicate The skip configuration predicate that will run with the suite instance
 * @kind decorator
 */
export function SkipIfNot<T = unknown>(predicate: SkipPredicate<T>): ClassDecorator & MethodDecorator {
  return SkipIf<T>(async (instance: T) => !(await predicate(instance)));
}

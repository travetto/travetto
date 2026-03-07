import { getClass } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

/**
 * Binds a field to be a test format type, which is validated against the registered test consumers
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function TestFormatField() {
  return function <K extends string, T extends Partial<Record<K, string>>>(instance: T, property: K): void {
    const cls = getClass(instance);
    const types = ['tap', 'tap-summary', 'json', 'exec', 'event', 'xunit'];
    if (instance[property]?.includes('/')) {
      types.unshift(instance[property]);
    }

    SchemaRegistryIndex.getForRegister(cls).registerField(property, {
      enum: {
        message: `{path} is only allowed to be "${types.join('" or "')}"`,
        values: types
      },
      description: 'Output format for test results',
      default: 'tap',
      required: {
        active: false
      }
    });
  };
}


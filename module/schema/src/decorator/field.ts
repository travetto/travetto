import { Any, ClassInstance, getClass } from '@travetto/runtime';

import { SchemaFieldConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

type PropType<V> = (<T extends Partial<Record<K, V | Function>>, K extends string>(t: T, k: K, idx?: TypedPropertyDescriptor<Any> | number) => void);

function field<V>(...obj: Partial<SchemaFieldConfig>[]): PropType<V> {
  return (instance: ClassInstance, property: string | symbol): void => {
    SchemaRegistryIndex.getForRegister(getClass(instance)).registerField(property, ...obj);
  };
}

/**
 * Registering a field
 * @param type The type for the field
 * @param config The field configuration
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Field(type: Pick<SchemaFieldConfig, 'type' | 'array'>, ...config: Partial<SchemaFieldConfig>[]): PropType<unknown> {
  return field(type, ...config);
}

/**
 * Mark a field as writeonly
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Writeonly(): PropType<unknown> { return field({ access: 'writeonly' }); }

/**
 * Mark a field as readonly
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Readonly(): PropType<unknown> { return field({ access: 'readonly' }); }

/**
 * Mark a field as sensitive
 * @param active This determines if this field is sensitive or not.
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Secret(active = true): PropType<unknown> { return field({ secret: active }); }
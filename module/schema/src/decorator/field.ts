import { type Any, type ClassInstance, getConstructor } from '@travetto/runtime';

import { SchemaRegistryIndex } from '../service/registry-index.ts';
import type { SchemaFieldConfig } from '../service/types.ts';

type PropType<V> = <T extends Partial<Record<K, V | Function>>, K extends string>(
  instance: T,
  property: K,
  idx?: TypedPropertyDescriptor<Any> | number
) => void;

function field<V>(...configs: Partial<SchemaFieldConfig>[]): PropType<V> {
  return (instance: ClassInstance, property: string): void => {
    SchemaRegistryIndex.getForRegister(getConstructor(instance)).registerField(property, ...configs);
  };
}

/**
 * Registering a field
 * @param type The type for the field
 * @param configs The field configuration
 * @augments `@travetto/schema:Input`
 * @augments `@travetto/schema:Field`
 * @kind decorator
 */
export function Field(...configs: Partial<SchemaFieldConfig>[]): PropType<unknown> {
  return field(...configs);
}

/**
 * Mark a field as writeonly
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Writeonly(): PropType<unknown> {
  return field({ access: 'writeonly' });
}

/**
 * Mark a field as readonly
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Readonly(): PropType<unknown> {
  return field({ access: 'readonly' });
}

/**
 * Mark a field as sensitive
 * @param active This determines if this field is sensitive or not.
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Secret(active = true): PropType<unknown> {
  return field({ secret: active });
}

/**
 * Sets the discriminator field via a property decorator
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function DiscriminatorField(): (instance: ClassInstance, property: string) => void {
  return (instance: ClassInstance, property: string): void => {
    SchemaRegistryIndex.getForRegister(getConstructor(instance)).register({
      discriminatedBase: true,
      discriminatedField: property
    });
  };
}

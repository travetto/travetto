import { type ModelType, ModelRegistryIndex } from '@travetto/model';
import { type Class, type Any, castTo } from '@travetto/runtime';

import {
  type AllIndexes, type KeyedIndexSelection, type KeyedIndex,
  type SortedIndexSelection, type SortedIndex, type TemplatePart, type TemplateValue
} from './types/indexes.ts';

function buildTemplateParts<T extends TemplateValue = TemplateValue>(
  part: 'key' | 'sort',
  template: Record<string, unknown>,
  prefix: string[] = [],
): TemplatePart<T>[] {
  const out: TemplatePart<T>[] = [];
  for (const [key, value] of Object.entries(template)) {
    const path = prefix.length ? [...prefix, key] : [key];
    if (typeof value === 'object' && value !== null) {
      out.push(...buildTemplateParts<T>(part, castTo(value), path));
    } else {
      out.push({ path, value: castTo<T>(value), part });
    }
  }
  return out;
}

/**
 * Defines a keyed index for a model
 */
export function keyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>
>(cls: Class<T>, config: { name: string, key: K }): KeyedIndex<T, K, {}> {
  const { name, key } = config;
  const keyTemplate = buildTemplateParts<true>('key', key);
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    class: cls, name, unique: false,
    key, keyTemplate, sort: {}, sortTemplate: []
  };
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

/**
 * Defines a unique index for a model
 */
export function uniqueIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>
>(cls: Class<T>, config: { name: string, key: K }): KeyedIndex<T, K, {}> {
  const { name, key } = config;
  const keyTemplate = buildTemplateParts<true>('key', key);
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    class: cls, name, unique: true,
    key, keyTemplate, sort: {}, sortTemplate: []
  };
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

/**
 * Defines a sorted index for a model
 */
export function sortedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
>(cls: Class<T>, config: { name: string, key: K, sort: S }): SortedIndex<T, K, S> {
  const { name, key, sort } = config;
  const keyTemplate = buildTemplateParts<true>('key', key);
  const sortTemplate = buildTemplateParts<1 | -1>('sort', sort);
  const idx: SortedIndex<T, K, S> = {
    type: 'indexed:sorted',
    class: cls, name, key, sort,
    keyTemplate, sortTemplate,
  };
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

export const isModelIndexedIndex = <T extends ModelType>(idx: Any): idx is AllIndexes<T> =>
  typeof idx === 'object' && idx !== null && 'type' in idx && typeof idx.type === 'string' && idx.type.startsWith('indexed:');

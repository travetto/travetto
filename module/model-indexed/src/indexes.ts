import { type ModelType, ModelRegistryIndex } from '@travetto/model';
import { type Class, type Any, castTo } from '@travetto/runtime';

import {
  type AllIndexes, type KeyedIndexSelection, type KeyedIndex,
  type SortedIndexSelection, type SortedIndex, IndexedFieldError,
  type TemplatePart, type TemplateValue
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
>(cls: Class<T>, selection: K, name?: string): KeyedIndex<T, K, {}> {
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    name: name ?? `${cls.Ⲑid}__${Object.keys(selection).join('_')}`,
    key: selection,
    template: buildTemplateParts('key', selection),
    class: cls,
    sort: {},
    unique: false
  };
  if ('id' in selection) {
    throw new IndexedFieldError(cls, idx, 'id', 'Invalid field for index creation');
  }
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

/**
 * Defines a unique index for a model
 */
export function uniqueIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>
>(cls: Class<T>, key: K, name?: string): KeyedIndex<T, K, {}> {
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    name: name ?? `${cls.Ⲑid}__${Object.keys(key).join('_')}`,
    key,
    template: buildTemplateParts('key', key),
    class: cls,
    unique: true,
    sort: {},
  };
  if ('id' in key) {
    throw new IndexedFieldError(cls, idx, 'id', 'Invalid field for index creation');
  }
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
>(cls: Class<T>, key: K, sort: S, name?: string): SortedIndex<T, K, S> {
  const idx: SortedIndex<T, K, S> = {
    type: 'indexed:sorted',
    name: name ?? `${cls.Ⲑid}__${Object.keys(key).join('_')}`,
    key,
    sort,
    template: [...buildTemplateParts('key', key), ...buildTemplateParts('sort', sort)],
    class: cls,
  };
  if ('id' in key) {
    throw new IndexedFieldError(cls, idx, 'id', 'Invalid field for index creation');
  }
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

export const isModelIndexedIndex = <T extends ModelType>(idx: Any): idx is AllIndexes<T> =>
  typeof idx === 'object' && idx !== null && 'type' in idx && idx.type.startsWith('indexed:');

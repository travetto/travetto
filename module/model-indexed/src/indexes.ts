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

const buildIndexName = (cls: Class, template: TemplatePart[]) =>
  `${cls.name}__${template.map(item => item.path.join('.')).join('_')}`.toLowerCase();

/**
 * Defines a keyed index for a model
 */
export function keyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>
>(cls: Class<T>, key: K, name?: string): KeyedIndex<T, K, {}> {
  const keyTemplate = buildTemplateParts<true>('key', key);
  name ??= buildIndexName(cls, keyTemplate);
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
>(cls: Class<T>, key: K, name?: string): KeyedIndex<T, K, {}> {
  const keyTemplate = buildTemplateParts<true>('key', key);
  name ??= buildIndexName(cls, keyTemplate);
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
>(cls: Class<T>, key: K, sort: S, name?: string): SortedIndex<T, K, S> {
  const keyTemplate = buildTemplateParts<true>('key', key);
  const sortTemplate = buildTemplateParts<1 | -1>('sort', sort);
  name ??= name ?? buildIndexName(cls, keyTemplate);
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

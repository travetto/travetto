import { type ModelType, ModelRegistryIndex } from '@travetto/model';
import { type Class, RuntimeError, type Any } from '@travetto/runtime';
import type { AllIndexes } from './types/indexes.ts';
import type { KeyedIndexSelection, KeyedIndex, SortedIndexSelection, SortedIndex } from './types/indexes.ts';

/**
 * Defines a keyed index for a model
 */
export function keyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>
>(cls: Class<T>, selection: K, name?: string): KeyedIndex<T, K, {}> {
  if ('id' in selection) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    name: name ?? `${cls.Ⲑid}__${Object.keys(selection).join('_')}`,
    keys: selection,
    class: cls,
    sort: {},
    unique: false
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
>(cls: Class<T>, selection: K, name?: string): KeyedIndex<T, K, {}> {
  if ('id' in selection) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  const idx: KeyedIndex<T, K, {}> = {
    type: 'indexed:keyed',
    name: name ?? `${cls.Ⲑid}__${Object.keys(selection).join('_')}`,
    keys: selection, class: cls,
    sort: {},
    unique: true
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
>(cls: Class<T>, keys: K, sort: S, name?: string): SortedIndex<T, K, S> {
  if ('id' in sort) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  const idx: SortedIndex<T, K, S> = {
    type: 'indexed:sorted',
    name: name ?? `${cls.Ⲑid}__${Object.keys(keys).join('_')}`,
    keys,
    sort,
    class: cls,
    reversed: false
  };
  ModelRegistryIndex.getForRegister(cls).register({ indices: { [idx.name]: idx } });
  return idx;
}

export const isModelIndexedIndex = <T extends ModelType>(idx: Any): idx is AllIndexes<T> =>
  typeof idx === 'object' && idx !== null && 'type' in idx && idx.type.startsWith('indexed:');

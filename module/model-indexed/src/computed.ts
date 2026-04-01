import type { ModelType } from '@travetto/model';
import { castTo, type Any } from '@travetto/runtime';

import {
  type KeyedIndexSelection, type SortedIndexSelection, type AllIndexes, type KeyedIndexBody, IndexedFieldError,
  type FullKeyedIndexBody
} from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type PathValue<T = unknown> = { path: string[], value: unknown, templateValue: T, state: 'found' | 'missing' | 'empty' | 'mismatch' };

function processFields<T = unknown>(
  template: Record<string, T>,
  item: Record<string, unknown>,
  checkValueType?: (value: unknown) => boolean,
  prefix: string[] = [],
): PathValue<T>[] {
  const out: PathValue<T>[] = [];
  for (const [key, value] of Object.entries(template)) {
    const path = prefix.length ? [...prefix, key] : [key];
    const itemValue = item[key];
    if (!(key in item)) {
      out.push({ path, value: undefined!, templateValue: value, state: 'missing' });
    } else if (typeof value === 'object' && value !== null) {
      if (typeof itemValue === 'object' && itemValue !== null) {
        out.push(...processFields<T>(castTo(value), castTo(itemValue), checkValueType, path));
      } else if (itemValue === undefined || itemValue === null) {
        out.push({ path, value: undefined, templateValue: value, state: 'empty' });
      } else {
        out.push({ path, value: itemValue, templateValue: value, state: 'mismatch' });
      }
    } else {
      if (checkValueType && !checkValueType(itemValue)) {
        out.push({ path, value: itemValue, templateValue: value, state: 'mismatch' });
      } else {
        out.push({ path, value: itemValue, templateValue: value, state: 'found' });
      }
    }
  }
  return out;
}

function validate<T extends ModelType>(idx: AllIndexes<T>, fields: PathValue[]): void {
  for (const field of fields) {
    if (field.state === 'missing') {
      throw new IndexedFieldError(idx.class, idx, field.path.join('.'), 'Missing field');
    } else if (field.state === 'mismatch') {
      throw new IndexedFieldError(idx.class, idx, field.path.join('.'), 'Field type mismatch');
    }
  }
}


function getAndValidateFields<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
  idx: AllIndexes<T, K, S>,
  body: Body<T>,
  validateSorted = false
): [fields: PathValue<unknown>[], sorted: PathValue<-1 | 1>[]] {
  const fields = processFields<true>(castTo(idx.keys) ?? {}, body);
  const sorted = processFields<-1 | 1>(castTo(idx.sort) ?? {}, body, value => typeof value === 'number' || value instanceof Date);
  validate(idx, fields);
  if (validateSorted) {
    validate(idx, sorted);
  }
  return [fields, sorted];
}

type Body<T extends ModelType> = KeyedIndexBody<T, Any> | FullKeyedIndexBody<T, Any, Any> | Partial<T>;

export class ModelIndexedComputedIndex {
  static getMulti<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: AllIndexes<T, K, S>,
    body: Body<T>,
  ): ModelIndexedComputedIndex {
    return new ModelIndexedComputedIndex(...getAndValidateFields(idx, body));
  }

  static getSingle<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: AllIndexes<T, K, S>,
    body: Body<T>,
  ): ModelIndexedComputedIndex {
    return new ModelIndexedComputedIndex(...getAndValidateFields(idx, body, true));
  }

  fields: PathValue<unknown>[];
  sorted: PathValue<-1 | 1>[];

  constructor(
    fields: PathValue<unknown>[],
    sorted: PathValue<-1 | 1>[],
  ) {
    this.fields = fields;
    this.sorted = sorted;
  }

  getKey(sep = DEFAULT_SEP): string {
    return this.fields.map(({ value }) => value).map(value => `${value}`).join(sep);
  }

  getKeyWithSort(sep = DEFAULT_SEP): string {
    return [...this.fields, ...this.sorted].map(({ value }) => value).map(value => `${value}`).join(sep);
  }

  getSort(): number {
    const { value } = this.sorted[0] ?? {};
    const direction = (this.sorted[0]?.templateValue ?? 1);
    if (value instanceof Date) {
      return value.getTime() * direction;
    } else if (typeof value === 'number') {
      return value * direction;
    } else {
      return 0;
    }
  }

  project(emptyValue: unknown = null): Record<string, unknown> {
    const response: Record<string, unknown> = {};
    for (const { path, value, state } of this.fields) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const part of all) {
        sub = castTo(sub[part] ??= {});
      }
      sub[last] = state === 'empty' ? emptyValue : value;
    }
    return response;
  }

  projectWithSort(emptyValue: unknown = null, emptySortValue: unknown = null): Record<string, unknown> {
    const response: Record<string, unknown> = {};
    for (const { path, value, state } of this.fields) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const part of all) {
        sub = castTo(sub[part] ??= {});
      }
      sub[last] = state === 'empty' ? emptyValue : value;
    }
    for (const { path, value, state } of this.sorted) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const part of all) {
        sub = castTo(sub[part] ??= {});
      }
      sub[last] = state === 'empty' ? emptySortValue : value;
    }
    return response;
  }
}
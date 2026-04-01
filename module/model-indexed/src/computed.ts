import type { ModelType } from '@travetto/model';
import { castTo, type Any } from '@travetto/runtime';

import {
  type KeyedIndexSelection, type SortedIndexSelection, type AllIndexes, type KeyedIndexBody, IndexedFieldError,
  type FullKeyedIndexBody
} from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type TemplateValue = 1 | -1 | true;
type PathValue<T extends TemplateValue = TemplateValue> = {
  path: string[];
  value: unknown;
  part: 'key' | 'sort';
  templateValue: T;
  state: 'found' | 'missing' | 'empty' | 'mismatch';
};

function processFields<T extends TemplateValue = TemplateValue>(
  part: 'key' | 'sort',
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
      out.push({ path, value: undefined!, templateValue: value, state: 'missing', part });
    } else if (typeof value === 'object' && value !== null) {
      if (typeof itemValue === 'object' && itemValue !== null) {
        out.push(...processFields<T>(part, castTo(value), castTo(itemValue), checkValueType, path));
      } else if (itemValue === undefined || itemValue === null) {
        out.push({ path, value: undefined, templateValue: value, state: 'empty', part });
      } else {
        out.push({ path, value: itemValue, templateValue: value, state: 'mismatch', part });
      }
    } else {
      if (checkValueType && !checkValueType(itemValue)) {
        out.push({ path, value: itemValue, templateValue: value, state: 'mismatch', part });
      } else {
        out.push({ path, value: itemValue, templateValue: value, state: 'found', part });
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

function getFields<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
  idx: AllIndexes<T, K, S>,
  body: Body<T>,
): [keyFields: PathValue<true>[], sortFields: PathValue<-1 | 1>[]] {
  const keyFields = processFields<true>('key', castTo(idx.keys) ?? {}, body);
  const sortFields = processFields<-1 | 1>('sort', castTo(idx.sort) ?? {}, body, value => typeof value === 'number' || value instanceof Date);
  return [keyFields, sortFields];
}

type Body<T extends ModelType> = KeyedIndexBody<T, Any> | FullKeyedIndexBody<T, Any, Any> | Partial<T>;

type IndexProcessConfig<T = {}> = T & { keyed?: boolean, sort?: boolean };

export class ModelIndexedComputedIndex {
  static get<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: AllIndexes<T, K, S>,
    body: Body<T>,
  ): ModelIndexedComputedIndex {
    return new ModelIndexedComputedIndex(idx, ...getFields(idx, body));
  }

  keyedFields: PathValue<true>[];
  sortFields: PathValue<-1 | 1>[];
  idx: AllIndexes<ModelType>;

  constructor(
    idx: AllIndexes<ModelType>,
    keyedFields: PathValue<true>[],
    sortFields: PathValue<-1 | 1>[],
  ) {
    this.idx = idx;
    this.keyedFields = keyedFields;
    this.sortFields = sortFields;
  }

  get allFields(): PathValue[] {
    return [...this.keyedFields, ...this.sortFields];
  }

  validate(config: IndexProcessConfig = {}): this {
    const { keyed = true, sort = false } = config;
    if (keyed) {
      validate(this.idx, this.keyedFields);
    }
    if (sort) {
      validate(this.idx, this.sortFields);
    }
    return this;
  }

  getKey(config: IndexProcessConfig<{ sep?: string }> = {}): string {
    const { keyed = true, sort = false, sep = DEFAULT_SEP } = config;
    const parts = [keyed ? this.keyedFields : [], sort ? this.sortFields : []].flat();
    return parts.map(({ value }) => value).map(value => `${value}`).join(sep);
  }

  getSort(): number {
    const { value } = this.sortFields[0] ?? {};
    const direction = (this.sortFields[0]?.templateValue ?? 1);
    if (value instanceof Date) {
      return value.getTime() * direction;
    } else if (typeof value === 'number') {
      return value * direction;
    } else {
      return 0;
    }
  }

  project(config: IndexProcessConfig<{ emptyValue?: unknown, emptySortValue?: unknown }> = {}): Record<string, unknown> {
    const { keyed = true, sort = false, emptyValue = null, emptySortValue = null } = config;
    const response: Record<string, unknown> = {};
    if (keyed) {
      for (const { path, value, state } of this.keyedFields) {
        let sub: Record<string, unknown> = response;
        const all = path.slice(0);
        const last = all.pop()!;
        for (const part of all) {
          sub = castTo(sub[part] ??= {});
        }
        sub[last] = state === 'empty' ? emptyValue : value;
      }
    }
    if (sort) {
      for (const { path, value, state } of this.sortFields) {
        let sub: Record<string, unknown> = response;
        const all = path.slice(0);
        const last = all.pop()!;
        for (const part of all) {
          sub = castTo(sub[part] ??= {});
        }
        sub[last] = state === 'empty' ? emptySortValue : value;
      }
    }
    return response;
  }
}
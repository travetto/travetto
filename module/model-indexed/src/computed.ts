import type { ModelType } from '@travetto/model';
import { castTo, type Any } from '@travetto/runtime';

import {
  type KeyedIndexSelection, type SortedIndexSelection, type AllIndexes, type KeyedIndexBody, IndexedFieldError,
  type FullKeyedIndexBody
} from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type TemplateValue = 1 | -1 | true;
type TemplatePart<T extends TemplateValue = TemplateValue> = {
  path: string[];
  part: 'key' | 'sort';
  value: T;
};
type BodyPart = {
  state: 'missing' | 'empty' | 'mismatch' | 'found';
  value: unknown;
};
type IndexPart<T extends TemplateValue = TemplateValue> = {
  body: BodyPart;
  template: TemplatePart<T>;
};

function buildIndexParts<T extends TemplateValue = TemplateValue>(
  part: 'key' | 'sort',
  template: Record<string, T>,
  item: Record<string, unknown> | undefined,
  checkValueType?: (value: unknown) => boolean,
  prefix: string[] = [],
): IndexPart<T>[] {
  const out: IndexPart<T>[] = [];
  for (const [key, value] of Object.entries(template)) {
    const path = prefix.length ? [...prefix, key] : [key];
    const itemValue = (typeof item === 'object' && item !== null) ? item[key] : undefined;

    if (typeof value === 'object' && value !== null) {
      out.push(...buildIndexParts<T>(part, castTo(value), castTo(itemValue), checkValueType, path));
      continue;
    }

    const templatePart: TemplatePart<T> = { path, value, part };
    let bodyPart: BodyPart;
    if (typeof item !== 'object') {
      bodyPart = { value: item, state: 'mismatch' };
    } else if (item === null || item === undefined) {
      bodyPart = { value: null, state: 'empty' };
    } else if (!(key in item)) {
      bodyPart = { value: undefined!, state: 'missing' };
    } else {
      if (checkValueType && !checkValueType(itemValue)) {
        bodyPart = { value: itemValue, state: 'mismatch' };
      } else {
        bodyPart = { value: itemValue, state: 'found' };
      }
    }
    out.push({ template: templatePart, body: bodyPart });
  }
  return out;
}

function validate<T extends ModelType>(idx: AllIndexes<T>, parts: IndexPart[]): void {
  for (const { body: { state }, template: { path } } of parts) {
    if (state === 'missing') {
      throw new IndexedFieldError(idx.class, idx, path.join('.'), 'Missing field');
    } else if (state === 'mismatch') {
      throw new IndexedFieldError(idx.class, idx, path.join('.'), 'Field type mismatch');
    }
  }
}

type Body<T extends ModelType> = KeyedIndexBody<T, Any> | FullKeyedIndexBody<T, Any, Any> | Partial<T>;

type IndexProcessConfig<T = {}> = T & { keyed?: boolean, sort?: boolean };

export class ModelIndexedComputedIndex {
  static get<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: AllIndexes<T, K, S>,
    body: Body<T> = {},
  ): ModelIndexedComputedIndex {
    return new ModelIndexedComputedIndex(idx,
      buildIndexParts('key', castTo(idx.keys) ?? {}, castTo(body)),
      buildIndexParts('sort', castTo(idx.sort) ?? {}, castTo(body), value => typeof value === 'number' || value instanceof Date)
    );
  }

  keyedParts: IndexPart<true>[];
  sortParts: IndexPart<-1 | 1>[];
  idx: AllIndexes<ModelType>;

  constructor(
    idx: AllIndexes<ModelType>,
    keyedParts: IndexPart<true>[],
    sortParts: IndexPart<-1 | 1>[]
  ) {
    this.idx = idx;
    this.keyedParts = keyedParts;
    this.sortParts = sortParts;
  }

  get allParts(): IndexPart[] {
    return [...this.keyedParts, ...this.sortParts];
  }

  validate(config: IndexProcessConfig = {}): this {
    const { keyed = true, sort = false } = config;
    if (keyed) {
      validate(this.idx, this.keyedParts);
    }
    if (sort) {
      validate(this.idx, this.sortParts);
    }
    return this;
  }

  getKey(config: IndexProcessConfig<{ sep?: string }> = {}): string {
    const { keyed = true, sort = false, sep = DEFAULT_SEP } = config;
    const parts = [keyed ? this.keyedParts : [], sort ? this.sortParts : []].flat();
    return parts.map(({ body: { value } }) => value).map(value => `${value}`).join(sep);
  }

  getSort(): number {
    const { body: { value } } = this.sortParts[0] ?? {};
    const direction = (this.sortParts[0]?.template?.value ?? 1);
    if (value instanceof Date) {
      return value.getTime() * direction;
    } else if (typeof value === 'number') {
      return value * direction;
    } else {
      return 0;
    }
  }

  project(config: IndexProcessConfig<{ emptyValue?: unknown }> = {}): Record<string, unknown> {
    const { keyed = true, sort = false, emptyValue = null } = config;
    const response: Record<string, unknown> = {};
    if (keyed) {
      for (const { template: { path }, body: { value, state } } of this.keyedParts) {
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
      for (const { template: { path }, body: { value, state } } of this.sortParts) {
        let sub: Record<string, unknown> = response;
        const all = path.slice(0);
        const last = all.pop()!;
        for (const part of all) {
          sub = castTo(sub[part] ??= {});
        }
        sub[last] = state === 'empty' ? emptyValue : value;
      }
    }
    return response;
  }
}
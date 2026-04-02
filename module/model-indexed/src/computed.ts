import type { ModelType } from '@travetto/model';
import { castTo, type Any } from '@travetto/runtime';

import {
  type KeyedIndexSelection, type SortedIndexSelection, type AllIndexes, type KeyedIndexBody, IndexedFieldError,
  type FullKeyedIndexBody, type TemplateValue, type TemplatePart
} from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type IndexPart<T extends TemplateValue = TemplateValue> = {
  state: 'missing' | 'empty' | 'mismatch' | 'found';
  value: unknown;
  path: string[];
  templateValue: T;
};

function buildIndexParts<T extends TemplateValue = TemplateValue>(
  template: TemplatePart<T>[],
  body: Record<string, unknown> | undefined,
  checkValueType?: (value: unknown) => boolean,
): IndexPart<T>[] {
  const out: IndexPart<T>[] = [];
  for (const { path, value: templateValue } of template) {
    let value: unknown = body;
    let bodyPart: Pick<IndexPart, 'value' | 'state'> | undefined;
    for (const pathItem of path) {
      if (typeof value === 'object' && value !== null) {
        if (value && pathItem in value) {
          value = castTo<Record<string, unknown>>(value)[pathItem];
        } else {
          bodyPart = { value: undefined!, state: 'missing' };
          break;
        }
      } else {
        bodyPart = { value: undefined!, state: 'mismatch' };
        break;
      }
    }
    if (bodyPart === undefined) {
      if (value === null || value === undefined) {
        bodyPart = { value: null, state: 'empty' };
      } else if (checkValueType && !checkValueType(value)) {
        bodyPart = { value, state: 'mismatch' };
      } else {
        bodyPart = { value, state: 'found' };
      }
    }
    out.push({ ...bodyPart, path, templateValue });
  }
  return out;
}

function validate<T extends ModelType>(idx: AllIndexes<T>, parts: IndexPart[]): void {
  for (const { state, path } of parts) {
    if (state === 'missing') {
      throw new IndexedFieldError(idx.class, idx, path.join('.'), 'Missing field');
    } else if (state === 'mismatch') {
      throw new IndexedFieldError(idx.class, idx, path.join('.'), 'Field type mismatch');
    }
  }
}

type Body<T extends ModelType> = KeyedIndexBody<T, Any> | FullKeyedIndexBody<T, Any, Any> | Partial<T>;

type IndexProcessConfig<T = {}> = T & { keyed?: boolean, sort?: boolean };

export class ModelIndexedComputedIndex<T extends ModelType> {
  static get<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: AllIndexes<T, K, S>,
    body: Body<T>,
  ): ModelIndexedComputedIndex<T> {
    return new ModelIndexedComputedIndex(idx, body);
  }

  keyedParts: IndexPart<true>[];
  sortParts: IndexPart<-1 | 1>[];
  idx: AllIndexes<T>;

  constructor(
    idx: AllIndexes<T>,
    body: Body<T>,
  ) {
    this.idx = idx;
    this.keyedParts = buildIndexParts(idx.keyTemplate, castTo(body));
    this.sortParts = buildIndexParts(idx.sortTemplate, castTo(body), value => typeof value === 'number' || value instanceof Date);
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

  getKey(config: IndexProcessConfig<{ sep?: string, emptyValue?: string }> = {}): string {
    const { keyed = true, sort = false, sep = DEFAULT_SEP } = config;
    const parts = [keyed ? this.keyedParts : [], sort ? this.sortParts : []].flat();
    const result = parts.map(({ value }) => value).map(value => `${value}`).join(sep);
    if (!result && config.emptyValue) {
      return config.emptyValue;
    }
    return result;
  }

  getSort(): number {
    const { value } = this.sortParts[0] ?? {};
    const direction = (this.sortParts[0]?.templateValue ?? 1);
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
      for (const { path, value, state } of this.keyedParts) {
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
      for (const { path, value, state } of this.sortParts) {
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
import type { ModelType } from '@travetto/model';
import { castTo, type Class, type Primitive } from '@travetto/runtime';

import { type KeyedIndexSelection, type SortedIndexSelection, type AllIndexes, type KeyedIndexBody, MissingIndexedFieldError, type FullKeyedIndexBody } from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type ComputeConfig = {
  emptyValue?: unknown;
  emptySortValue?: unknown;
  separator?: string;
};

type PathValue<V, T> = { path: string[], value: V, templateValue: T };

function matchFields<V, T>(
  idx: AllIndexes<any, any, any>,
  template: Record<string, T>,
  item: Record<string, unknown>,
  emptyValue?: unknown,
  prefix: string[] = []): PathValue<V, T>[] {
  const out: PathValue<V, T>[] = [];
  for (const [key, value] of Object.entries(template)) {
    const path = prefix.length ? [...prefix, key] : [key];
    const itemValue = item[key];
    if (typeof value === 'object' && value !== null) {
      if (typeof itemValue === 'object' && itemValue !== null) {
        out.push(...matchFields<V, T>(idx, castTo(value), castTo(itemValue), emptyValue, path));
      } else if ((itemValue === undefined || itemValue === null) && emptyValue !== undefined && emptyValue !== Error) {
        out.push({ path, value: castTo(emptyValue), templateValue: value });
      } else {
        throw new MissingIndexedFieldError(idx.class, idx, prefix.join('.'));
      }
    } else {
      out.push({ path, value: castTo(item[key]), templateValue: value });
    }
  }
  return out;
}

export class ModelIndexedComputedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> {
  mode: 'single' | 'multi';
  idx: AllIndexes<T, K, S>;
  fields: PathValue<Primitive | Date, unknown>[];
  sorted: PathValue<number | Date, -1 | 1>[];
  config: ComputeConfig;

  constructor(
    mode: 'single' | 'multi',
    idx: AllIndexes<T, K, S>,
    body: KeyedIndexBody<T, K> | FullKeyedIndexBody<T, K, S> | Partial<T>,
    config: ComputeConfig = {},
  ) {
    this.mode = mode;
    this.idx = idx;
    this.config = config;
    this.fields = ('keys' in idx) ? matchFields<Primitive | Date, true>(idx, castTo(idx.keys), body, config.emptyValue) : [];
    this.sorted = ('sort' in idx) ? matchFields<number | Date, -1 | 1>(idx, castTo(idx.sort), body, config.emptySortValue) : [];
    this.validate();
  }

  validate() {
    // Do validation checks here 
  }

  get key(): string {
    return this.fields.map(({ value }) => value).map(value => `${value}`).join(this.config?.separator ?? DEFAULT_SEP);
  }

  get fullKey(): string {
    return this.fullFields.map(({ value }) => value).map(value => `${value}`).join(this.config?.separator ?? DEFAULT_SEP);
  }

  get fullFields(): PathValue<Primitive | Date, unknown>[] {
    return [...this.fields, ...this.sorted];
  }

  get sort(): number | undefined {
    const { value } = this.sorted[0] ?? {};
    if (value === undefined) {
      return undefined;
    }
    const direction = (this.sorted[0]?.templateValue ?? 1);
    if (value instanceof Date) {
      return value.getTime() * direction;
    } else {
      return value * direction;
    }
  }

  project(): Record<string, unknown> {
    const response: Record<string, unknown> = {};
    for (const { path, value } of this.fields) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const part of all) {
        sub = castTo(sub[part] ??= {});
      }
      sub[last] = value;
    }
    return response;
  }

  fullProject(): Record<string, unknown> {
    const response: Record<string, unknown> = {};
    for (const { path, value } of [...this.fields, ...this.sorted]) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const part of all) {
        sub = castTo(sub[part] ??= {});
      }
      sub[last] = value;
    }
    return response;
  }
}
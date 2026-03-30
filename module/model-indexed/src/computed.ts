import type { ModelType } from '@travetto/model';
import { castTo, RuntimeError, type Class, type Primitive } from '@travetto/runtime';
import type { KeyedIndexSelection, SortedIndexSelection, AllIndexes, KeyedIndexBody } from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type ComputeConfig = {
  includeSortInFields?: boolean;
  emptyValue?: unknown;
  emptySortValue?: unknown;
  separator?: string;
};

type PathValue<V, T> = { path: string[], value: V, templateValue: T };

function matchFields<V, T>(
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
        out.push(...matchFields<V, T>(castTo(value), castTo(itemValue), emptyValue, path));
      } else if ((itemValue === undefined || itemValue === null) && emptyValue !== undefined && emptyValue !== Error) {
        out.push({ path, value: castTo(emptyValue), templateValue: value });
      } else {
        throw new RuntimeError(`Missing field value for ${prefix.join('.')}`);
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
  cls: Class<T>;
  idx: AllIndexes<T, K, S>;
  fields: PathValue<Primitive | Date, unknown>[];
  sorted: PathValue<number | Date, -1 | 1>[];
  config: ComputeConfig;

  constructor(
    cls: Class<T>,
    idx: AllIndexes<T, K, S>,
    body: KeyedIndexBody<T, K>,
    config: ComputeConfig = {},
  ) {
    this.cls = cls;
    this.idx = idx;
    this.config = config;
    this.fields = ('keys' in idx) ? matchFields<Primitive | Date, true>(castTo(idx.keys), body, config.emptyValue) : [];
    this.sorted = ('sort' in idx) ? matchFields<number | Date, -1 | 1>(castTo(idx.sort), body, config.emptySortValue) : [];

    if (this.sorted.length > 0 && config.includeSortInFields === true) {
      this.fields.push(...this.sorted);
    }
  }

  hasKey(): boolean {
    return this.fields.length > 0;
  }

  get key(): string {
    return this.fields.map(({ value }) => value).map(value => `${value}`).join(this.config?.separator ?? DEFAULT_SEP);
  }

  get sort(): number | Date | undefined {
    return this.sorted[0]?.value;
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
}
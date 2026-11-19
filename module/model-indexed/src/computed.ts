import { ModelRegistryIndex, type ModelType } from '@travetto/model';
import { type Any, castTo, isRecord, type Primitive, type SimpleFields } from '@travetto/runtime';
import { DataUtil, type Point } from '@travetto/schema';

import { IndexedFieldError } from './types/error.ts';
import type {
  AllIndexes,
  FullKeyedIndexBody,
  FullKeyedIndexWithPartialBody,
  KeyedIndexBody,
  KeyedIndexSelection,
  SingleItemIndex,
  SortedIndex,
  SortedIndexSelection,
  TemplatePart,
  TemplateValue
} from './types/indexes.ts';

const DEFAULT_SEP = '\u8203';

type IndexPart<T extends TemplateValue = TemplateValue, V = unknown> = {
  state: 'missing' | 'empty' | 'mismatch' | 'found';
  value: V;
  path: string[];
  templateValue: T;
};

type IndexedPrimitiveFields<T> = Pick<T, SimpleFields<T, Primitive | Date | Point>>;

type IndexedProjectClauseRaw<T> = {
  -readonly [P in keyof T]?: T[P] extends number | undefined
    ? number
    : T[P] extends bigint | undefined
      ? bigint
      : T[P] extends string | undefined
        ? string
        : T[P] extends boolean | undefined
          ? boolean
          : T[P] extends Date | undefined
            ? Date
            : T[P] extends Point | undefined
              ? Point
              : T[P] extends (infer U)[] | undefined
                ? U[]
                : T[P] extends object | undefined
                  ? IndexedProjectClauseRaw<IndexedPrimitiveFields<T[P]>>
                  : never;
};
export type IndexedProjectClause<T> = IndexedProjectClauseRaw<IndexedPrimitiveFields<T>>;

function buildIndexParts<T extends TemplateValue = TemplateValue>(
  template: TemplatePart<T>[],
  body: unknown,
  checkValueType?: (value: unknown) => boolean
): IndexPart<T>[] {
  const out: IndexPart<T>[] = [];
  for (const { path, value: templateValue } of template) {
    const { found, value } = DataUtil.getPath(body, path);
    let bodyPart: Pick<IndexPart, 'value' | 'state'>;
    if (!found) {
      bodyPart = isRecord(value) ? { value: null, state: 'missing' } : { value, state: 'mismatch' };
    } else if (value === null || value === undefined) {
      bodyPart = { value: null, state: 'empty' };
    } else if (checkValueType && !checkValueType(value)) {
      bodyPart = { value, state: 'mismatch' };
    } else {
      bodyPart = { value, state: 'found' };
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

type Body<T extends ModelType, K extends KeyedIndexSelection<T> = Any, S extends SortedIndexSelection<T> = Any> =
  | T
  | KeyedIndexBody<T, K>
  | FullKeyedIndexBody<T, K, S>
  | FullKeyedIndexWithPartialBody<T, K, S>
  | Partial<T>;

type IndexProcessConfig<T = {}> = T & { keyed?: boolean; sort?: boolean };

export class ModelIndexedComputedIndex<T extends ModelType> {
  static get<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    idx: SingleItemIndex<T, K, S> | SortedIndex<T, K, S>,
    body: Body<T, K, S>
  ): ModelIndexedComputedIndex<T>;
  static get<T extends ModelType>(idx: AllIndexes<T>, body: Body<T>): ModelIndexedComputedIndex<T>;
  static get<T extends ModelType>(idx: AllIndexes<T>, body: Body<T> | object): ModelIndexedComputedIndex<T> {
    return new ModelIndexedComputedIndex(idx, body);
  }

  keyedParts: IndexPart<true>[];
  sortParts: IndexPart<-1 | 1>[];
  idPart: IndexPart<true, string> | undefined;
  idx: AllIndexes<T>;

  constructor(idx: AllIndexes<T>, body: object) {
    this.idx = idx;
    this.keyedParts = buildIndexParts(idx.keyTemplate, body);
    this.sortParts = buildIndexParts(
      idx.sortTemplate,
      body,
      value => typeof value === 'number' || value instanceof Date || typeof value === 'string'
    );
    const idSource = ModelRegistryIndex.get(idx.class).idSource;
    const identifier = idSource.get(castTo(body), { optional: true });
    if (typeof identifier === 'string') {
      const idField = idSource.field;
      this.idPart = {
        path: [idField],
        value: identifier,
        state: 'found',
        templateValue: true
      };
    }
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
    return parts
      .map(({ value }) => value)
      .map(value => `${value}`)
      .join(sep);
  }

  getSort(): number | string {
    const { value } = this.sortParts[0] ?? {};
    const direction = this.sortParts[0]?.templateValue ?? 1;
    if (value instanceof Date) {
      return value.getTime() * direction;
    } else if (typeof value === 'number') {
      return value * direction;
    } else if (typeof value === 'string') {
      return value;
    } else {
      return 0;
    }
  }

  project(config: IndexProcessConfig<{ emptyValue?: unknown; includeId?: boolean }> = {}): IndexedProjectClause<T> {
    const { keyed = true, sort = false, emptyValue = null, includeId } = config;
    const response: Partial<T> = {};
    for (const { path, value, state } of [...(keyed ? this.keyedParts : []), ...(sort ? this.sortParts : [])]) {
      DataUtil.setPath(response, path, state === 'empty' ? emptyValue : value);
    }
    if (includeId && this.idPart) {
      // @ts-expect-error
      response.id = this.idPart.state === 'empty' ? emptyValue : this.idPart.value;
    }
    return castTo<T>(response);
  }
}

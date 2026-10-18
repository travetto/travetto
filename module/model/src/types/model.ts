declare const modelIdTag: unique symbol;

/**
 * Model Identifier branded type
 * @specifier modelId
 */
export type ModelId = string & { readonly [modelIdTag]?: null };

export type IsModelId<T> = typeof modelIdTag extends keyof NonNullable<T> ? true : false;

export type ModelIdKey<T> = {
  [K in keyof T]: IsModelId<T[K]> extends true ? K : never;
}[keyof T] extends infer M
  ? [M] extends [never]
    ? 'id' extends keyof T
      ? 'id'
      : never
    : M
  : never;

/**
 * Type where the model's identifier field is optional, but other required fields remain mandatory
 */
export type OptionalId<T> = {
  [K in keyof T as K extends ModelIdKey<T> ? never : K]: T[K];
} & {
  [K in keyof T as K extends ModelIdKey<T> ? K : never]?: T[K];
};

/**
 * Type where the model's identifier field is required, but other fields are optional
 */
export type PartialWithId<T> = {
  [K in keyof T as K extends ModelIdKey<T> ? never : K]?: T[K];
} & {
  [K in keyof T as K extends ModelIdKey<T> ? K : never]-?: T[K];
};

export type ModelType = object;

/**
 * Options for listing items
 */
export interface ModelListOptions {
  abort?: AbortSignal;
  limit?: number;
  batchSizeHint?: number;
}

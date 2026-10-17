declare const modelIdTag: unique symbol;

/**
 * Model Identifier branded type
 * @specifier modelId
 * @specifier no-generate
 */
export type ModelId = string & { readonly [modelIdTag]?: null };

export type IsModelId<T> = typeof modelIdTag extends keyof NonNullable<T> ? true : false;

/**
 * Type where the model's identifier field is optional, but other required fields remain mandatory
 */
export type OptionalId<T> = {
  [K in keyof T as IsModelId<T[K]> extends true ? never : K]: T[K];
} & {
  [K in keyof T as IsModelId<T[K]> extends true ? K : never]?: T[K];
};

/**
 * Type where the model's identifier field is required, but other fields are optional
 */
export type PartialWithId<T> = {
  [K in keyof T as IsModelId<T[K]> extends true ? never : K]?: T[K];
} & {
  [K in keyof T as IsModelId<T[K]> extends true ? K : never]-?: T[K];
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

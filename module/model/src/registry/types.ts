import type { Class } from '@travetto/runtime';

import type { ModelId, ModelType } from '../types/model.ts';

export type DataHandler<T = unknown> = (inst: T) => Promise<T | void> | T | void;

export type PrePersistScope = 'full' | 'partial' | 'all';

/**
 * Index options
 */
export type IndexConfig<V extends string = string, T extends ModelType = ModelType> = {
  /**
   * Index name
   */
  name: string;
  /**
   * Type
   */
  type: V;
  /**
   * Class the index belongs to
   */
  class: Class<T>;
};

/**
 * Model config
 */
export class ModelConfig<T extends ModelType = ModelType> {
  /**
   * Class for model
   */
  class: Class<T>;
  /**
   * Store name
   */
  store: string;
  /**
   * Identifier field name
   */
  idField: [keyof T] extends [never] ? string : Extract<keyof T, string>;
  /**
   * Identifier generator function
   */
  idGenerator: () => ModelId;
  /**
   * Indices
   */
  indices?: Record<string, IndexConfig>;
  /**
   * Vendor specific extras
   */
  extra?: object;
  /**
   * Expiry field
   */
  expiresAt?: string;
  /**
   * Allows auto creation of a model storage backing at runtime
   */
  autoCreate?: 'production' | 'development' | 'off';
  /**
   * Pre-persist handlers
   */
  prePersist?: { scope: PrePersistScope; handler: DataHandler<unknown> }[];
  /**
   * Post-load handlers
   */
  postLoad?: DataHandler<unknown>[];
  /**
   * Fields to ignore during persistence
   */
  transientFields?: string[];
}

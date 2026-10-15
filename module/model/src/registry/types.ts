import type { Class } from '@travetto/runtime';

import type { ModelIdGenerator, ModelType } from '../types/model.ts';

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
 * Model identifier configuration
 */
export type ModelIdConfig<T extends ModelType = ModelType> = {
  /**
   * Identifier field name
   */
  field: [keyof T] extends [never] ? string : Extract<keyof T, string>;
  /**
   * Identifier generator function, or false for manual natural keys
   */
  generator?: ModelIdGenerator | false;
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
   * Identifier configuration
   */
  id?: ModelIdConfig<T>;
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

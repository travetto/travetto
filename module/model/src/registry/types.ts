import type { Class } from '@travetto/runtime';

import type { ModelType } from '../types/model.ts';

export type DataHandler<T = unknown> = (inst: T) => (Promise<T | void> | T | void);

export type PrePersistScope = 'full' | 'partial' | 'all';

/**
 * Index options
 */
export type IndexConfig = {
  /**
   * Index name
   */
  name: string;
  /**
   * Type
   */
  type: string;
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
  prePersist?: { scope: PrePersistScope, handler: DataHandler<unknown> }[];
  /**
   * Post-load handlers
   */
  postLoad?: DataHandler<unknown>[];
}
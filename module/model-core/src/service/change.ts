import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';
import { ModelCore } from './core';
import { ModelType } from '../types/model';

/**
 * This interface defines the behavior for when a model is
 * added/removed/changed.  This is intended to be used during
 * development only for rapid prototyping.
 */
export interface ModelChangeable extends ModelCore {
  /**
   * An event listener for whenever a model is added or removed
   */
  onModelVisiblity<T extends ModelType>(e: ChangeEvent<Class<T>>): void;
  onModelSchema?(e: SchemaChangeEvent): void;
}
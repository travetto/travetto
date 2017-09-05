import { Class } from '@encore/schema';
import { ModelOptions } from './types';

export class ModelRegistry {
  static options = new Map<Class, ModelOptions>();
}
import { Class } from '@travetto/runtime';
import { ChangeEvent } from '@travetto/registry';

import { SchemaFieldConfig, SchemaClassConfig, SchemaMethodConfig } from './types';

export interface FieldMapping {
  path: SchemaFieldConfig[];
  config: SchemaClassConfig;
}

export interface SchemaChangeEvent {
  cls: Class;
  fieldChanges: ChangeEvent<SchemaFieldConfig>[];
  methodChanges: ChangeEvent<SchemaMethodConfig>[];
}